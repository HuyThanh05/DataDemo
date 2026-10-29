"""Import only the two prepared business tables. Requires pymysql.
Uses the local application account after grant-business-import.sql was run.
Never modifies exam_scores, replaces a nonempty table, or prints passwords.
"""
import csv
import hashlib
import json
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import pymysql
ROOT=Path(__file__).resolve().parents[2]
report=json.loads((ROOT/"docs/business-data-preparation.json").read_text(encoding="utf-8"))
properties={}
for line in (ROOT/"backend/application-local.properties").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        key,value=line.split("=",1)
        properties[key.strip()]=value.strip()
connection=pymysql.connect(host="localhost",port=3306,user=properties.get("datademo.app.username","datademo_app_user"),password=properties["datademo.app.password"],database="datademo_source",charset="utf8mb4",autocommit=False)

def quote(value):
    assert re.fullmatch(r"[a-z_]+",value)
    return "`"+value+"`"

def text(value):
    if isinstance(value,Decimal): return format(value,"f")
    if isinstance(value,(datetime,date)): return value.isoformat()
    if isinstance(value,timedelta): return str(value).zfill(8)
    return str(value)

results=[]
try:
    for spec in report["datasets"]:
        table=spec["table"]
        assert table in {"superstore_sales","coffee_shop_sales"}
        path=ROOT/spec["csv"]
        assert hashlib.sha256(path.read_bytes()).hexdigest()==spec["csvSha256"]
        names=[f["name"] for f in spec["fields"]]
        definition=",".join(quote(f["name"])+" "+f["sqlType"]+" NOT NULL" for f in spec["fields"])
        with connection.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS "+quote(table)+" ("+definition+",PRIMARY KEY ("+quote(names[0])+")) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute("SELECT COUNT(*) FROM "+quote(table))
            count=cur.fetchone()[0]
            if count not in (0,spec["rows"]): raise RuntimeError(table+" already has different data; refusing to overwrite")
            if count==0:
                sql="INSERT INTO "+quote(table)+" ("+",".join(map(quote,names))+") VALUES ("+",".join(["%s"]*len(names))+")"
                with path.open(encoding="utf-8",newline="") as stream:
                    reader=csv.reader(stream);assert next(reader)==names
                    batch=[]
                    for row in reader:
                        batch.append(row)
                        if len(batch)==1000: cur.executemany(sql,batch);batch=[]
                    if batch:cur.executemany(sql,batch)
        # Compare every imported value in primary-key order, not only row counts.
        digest=hashlib.sha256();verified=0
        with connection.cursor(pymysql.cursors.SSCursor) as cur, path.open(encoding="utf-8",newline="") as stream:
            reader=csv.reader(stream);next(reader)
            cur.execute("SELECT "+",".join(map(quote,names))+" FROM "+quote(table)+" ORDER BY "+quote(names[0]))
            for actual in cur:
                expected=next(reader,None)
                normalized=[text(v) for v in actual]
                if expected!=normalized: raise RuntimeError(table+" value mismatch at row "+str(verified+1))
                digest.update(json.dumps(normalized,ensure_ascii=False,separators=(",",":")).encode("utf-8"));digest.update(b"\n")
                verified+=1
            assert next(reader,None) is None
        assert verified==spec["rows"]
        totals={}
        with connection.cursor() as cur:
            for field,total in spec["numericTotals"].items():
                cur.execute("SELECT SUM("+quote(field)+") FROM "+quote(table))
                value=cur.fetchone()[0];assert value==Decimal(total)
                totals[field]=format(value,"f")
        connection.commit()
        results.append({"table":table,"rows":verified,"rowSha256":digest.hexdigest(),"totals":totals})
        print(table,"verified",verified,"rows",flush=True)
except Exception:
    connection.rollback()
    raise
finally:
    connection.close()
(ROOT/"docs/business-data-import.json").write_text(json.dumps({"verifiedAt":datetime.now(timezone.utc).isoformat(),"database":"datademo_source","tables":results},ensure_ascii=False,indent=2),encoding="utf-8")
