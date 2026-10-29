"""Read source workbooks and prepare two deterministic MySQL-ready CSVs.
Run from the repository root with openpyxl and xlrd available.
"""
import csv
import hashlib
import io
import json
import sys
import zipfile
from collections import Counter
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tmp/business-deps"))
import xlrd
import openpyxl
RAW = ROOT / "data/raw/business"
OUT = ROOT / "data/processed/business"
OUT.mkdir(parents=True, exist_ok=True)
D = Decimal
PRECISION = D("0.000001")

def money(value):
    return format(D(str(value)).quantize(PRECISION, rounding=ROUND_HALF_UP), "f")

def field(name, label, sql_type, role="DIMENSION", allowed=None, default=None):
    if allowed is None:
        allowed = ["COUNT"] if role == "IDENTIFIER" else ["COUNT", "COUNT_DISTINCT"]
    return {"name": name, "label": label, "sqlType": sql_type, "role": role,
            "allowedAggregations": allowed, "defaultAggregation": default or allowed[0]}

def measure(name,label,default="SUM",allowed=None):
    return field(name,label,"DECIMAL(20,6)","MEASURE",allowed or ["COUNT","SUM","AVG","MIN","MAX"],default)

def write_dataset(table, name, fields, rows, source_path, source_url, download_url, date_column):
    keys = [f["name"] for f in fields]
    assert rows and len({r[0] for r in rows}) == len(rows), "Duplicate row identifiers"
    assert all(len(row) == len(keys) for row in rows)
    output = OUT / (table + ".csv")
    with output.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(keys)
        writer.writerows(rows)
    totals = {f["name"]: format(sum((D(row[i]) for row in rows),D(0)),"f")
              for i,f in enumerate(fields) if f["role"] == "MEASURE"}
    date_index = keys.index(date_column)
    result = {"table":table,"datasetName":name,"rows":len(rows),"fields":fields,
              "csv":output.relative_to(ROOT).as_posix(),"csvSha256":hashlib.sha256(output.read_bytes()).hexdigest(),
              "raw":source_path.relative_to(ROOT).as_posix(),"rawSha256":hashlib.sha256(source_path.read_bytes()).hexdigest(),
              "source":source_url,"download":download_url,"synthetic":True,"currency":"USD",
              "dateMin":min(r[date_index] for r in rows),"dateMax":max(r[date_index] for r in rows),
              "numericTotals":totals,
              "categories":{f["name"]:len({r[i] for r in rows}) for i,f in enumerate(fields) if f["role"]=="DIMENSION"}}
    print(table,len(rows),totals)
    return result

book=xlrd.open_workbook(RAW / "superstore.xls")
sheet=book.sheet_by_name("Orders")
expected=["Row ID","Order ID","Order Date","Ship Date","Ship Mode","Customer ID","Customer Name","Segment","Country","City","State","Postal Code","Region","Product ID","Category","Sub-Category","Product Name","Sales","Quantity","Discount","Profit"]
assert sheet.row_values(0)==expected
fields=[field("row_id","Mã dòng","INT","IDENTIFIER"),field("order_id","Mã đơn hàng","VARCHAR(32)"),field("order_date","Ngày đặt hàng","DATE"),field("ship_date","Ngày giao hàng","DATE"),field("ship_mode","Hình thức vận chuyển","VARCHAR(80)"),field("customer_id","Mã khách hàng","VARCHAR(32)"),field("customer_name","Khách hàng","VARCHAR(120)"),field("segment","Phân khúc","VARCHAR(80)"),field("country","Quốc gia","VARCHAR(80)"),field("city","Thành phố","VARCHAR(120)"),field("state","Bang","VARCHAR(120)"),field("postal_code","Mã bưu chính","VARCHAR(20)"),field("region","Khu vực","VARCHAR(80)"),field("product_id","Mã sản phẩm","VARCHAR(40)"),field("category","Nhóm sản phẩm","VARCHAR(80)"),field("sub_category","Loại sản phẩm","VARCHAR(100)"),field("product_name","Tên sản phẩm","VARCHAR(300)"),measure("sales","Doanh số (USD)"),field("quantity","Số lượng","INT","MEASURE",["COUNT","SUM","AVG","MIN","MAX"],"SUM"),measure("discount","Tỷ lệ giảm giá","AVG",["COUNT","AVG","MIN","MAX"]),measure("profit","Lợi nhuận (USD)"),field("order_month","Tháng đặt hàng","CHAR(7)")]
rows=[]
for i in range(1,sheet.nrows):
    values=sheet.row_values(i)
    if not any(v != "" for v in values): continue
    values[0]=str(int(values[0]))
    for j in (2,3): values[j]=xlrd.xldate_as_datetime(values[j],book.datemode).date().isoformat()
    values[11]=str(int(values[11])) if isinstance(values[11],(int,float)) else str(values[11])
    for j in (17,19,20): values[j]=money(values[j])
    assert values[18]==int(values[18]) and values[18]>0
    values[18]=str(int(values[18]))
    values.append(values[2][:7])
    rows.append([str(v) for v in values])
assert len(rows)==9994
superstore=write_dataset("superstore_sales","Superstore — Bán hàng",fields,rows,RAW/"superstore.xls","https://www.tableau.com/learn/tutorials/on-demand/getting-started","https://raw.githubusercontent.com/Simplilearn-Edu/Tableau-Datasets/master/Project%202/Sample%20-%20Superstore.xls","order_date")

archive=RAW / "coffee-shop.zip"
with zipfile.ZipFile(archive) as z:
    member=next(n for n in z.namelist() if n.endswith(".xlsx") and not n.startswith("__MACOS"))
    book=openpyxl.load_workbook(io.BytesIO(z.read(member)),read_only=True,data_only=True)
    values=book["Transactions"].iter_rows(values_only=True)
    assert list(next(values))==["transaction_id","transaction_date","transaction_time","transaction_qty","store_id","store_location","product_id","unit_price","product_category","product_type","product_detail"]
    rows=[]
    for source_row in values:
        if all(v is None for v in source_row): continue
        row=list(source_row)
        assert len(row)==11 and all(v is not None for v in row)
        row[0]=str(int(row[0]));row[1]=row[1].date().isoformat();row[2]=row[2].isoformat()
        assert row[3]==int(row[3]) and row[3]>0 and D(str(row[7]))>=0
        row[3]=str(int(row[3]));row[4]=str(int(row[4]));row[6]=str(int(row[6]));row[7]=money(row[7])
        row += [money(D(row[3])*D(row[7])),row[1][:7]]
        rows.append([str(v) for v in row])
    book.close()
assert len(rows)==149116
fields=[field("transaction_id","Mã giao dịch","INT","IDENTIFIER"),field("transaction_date","Ngày giao dịch","DATE"),field("transaction_time","Giờ giao dịch","TIME"),field("transaction_qty","Số lượng","INT","MEASURE",["COUNT","SUM","AVG","MIN","MAX"],"SUM"),field("store_id","Mã cửa hàng","VARCHAR(16)"),field("store_location","Cửa hàng","VARCHAR(80)"),field("product_id","Mã sản phẩm","VARCHAR(16)"),measure("unit_price","Đơn giá (USD)","AVG",["COUNT","AVG","MIN","MAX"]),field("product_category","Nhóm sản phẩm","VARCHAR(80)"),field("product_type","Loại sản phẩm","VARCHAR(120)"),field("product_detail","Tên sản phẩm","VARCHAR(200)"),measure("revenue","Doanh thu (USD)"),field("transaction_month","Tháng giao dịch","CHAR(7)")]
coffee=write_dataset("coffee_shop_sales","Coffee Shop — Bán cà phê",fields,rows,archive,"https://mavenanalytics.io/data-playground/coffee-shop-sales","https://maven-datasets.s3.amazonaws.com/Coffee+Shop+Sales/Coffee+Shop+Sales.zip","transaction_date")
report={"preparedAt":datetime.now(timezone.utc).isoformat(),"precision":"Money/ratios normalized to 6 decimal places to remove Excel binary floating-point noise; no currency conversion.","datasets":[superstore,coffee]}
(ROOT / "docs/business-data-preparation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
