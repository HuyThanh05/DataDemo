"""Register the two prepared tables through the existing DataDemo API.
Does not overwrite an existing dataset or create demo charts/dashboards.
"""
import argparse
import csv
import json
import urllib.error
import urllib.request
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlsplit
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument("--api",default="http://localhost:8080/api")
args=parser.parse_args()
assert urlsplit(args.api).hostname in {"localhost","127.0.0.1"}

def api(path,body=None):
    request=urllib.request.Request(args.api+path,data=json.dumps(body,ensure_ascii=False).encode("utf-8") if body is not None else None,headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(request,timeout=30) as response:
        return json.load(response)

report=json.loads((ROOT/"docs/business-data-preparation.json").read_text(encoding="utf-8"))
sources=api("/connections")
source=next(c for c in sources if c["databaseName"]=="datademo_source" and c["username"]=="datademo_reader" and c["host"] in {"localhost","127.0.0.1"})
available=api("/connections/"+str(source["id"])+"/tables")
existing=api("/datasets")
results=[]
for spec in report["datasets"]:
    assert spec["table"] in available
    dataset=next((d for d in existing if d["connectionId"]==source["id"] and d["tableName"]==spec["table"]),None)
    created=dataset is None
    if created:
        body={"name":spec["datasetName"],"connectionId":source["id"],"tableName":spec["table"],
              "columnLabels":{f["name"]:f["label"] for f in spec["fields"]},
              "columnSettings":{f["name"]:{k:f[k] for k in ["role","allowedAggregations","defaultAggregation"]} for f in spec["fields"]}}
        dataset=api("/datasets",body)
    detail=api("/datasets/"+str(dataset["id"]))
    preview=api("/datasets/"+str(dataset["id"])+"/preview")
    assert len(preview["rows"])==100
    assert {c["name"] for c in detail["columns"]}=={f["name"] for f in spec["fields"]}
    checks=[]
    tests=[("category","SUM","sales",None),("region","COUNT_DISTINCT","order_id",None),("category","SUM","profit",None)] if spec["table"]=="superstore_sales" else [("store_location","SUM","revenue",None),("product_category","SUM","transaction_qty",None),("store_location","SUM","revenue",("product_category","Coffee"))]
    with (ROOT/spec["csv"]).open(encoding="utf-8",newline="") as stream:
        rows=list(csv.DictReader(stream))
    for dimension,aggregation,metric,filter_ in tests:
        expected=defaultdict(Decimal)
        distinct=defaultdict(set)
        for row in rows:
            if filter_ and row[filter_[0]]!=filter_[1]: continue
            if aggregation=="COUNT_DISTINCT": distinct[row[dimension]].add(row[metric])
            else: expected[row[dimension]]+=Decimal(row[metric])
        if aggregation=="COUNT_DISTINCT": expected={key:Decimal(len(values)) for key,values in distinct.items()}
        config={"datasetId":detail["id"],"chartType":"bar","dimension":dimension,"aggregation":aggregation,"metricColumn":metric,"sortDirection":"ASC","filters":[] if filter_ is None else [{"column":filter_[0],"operator":"EQ","value":filter_[1]}]}
        result=api("/charts/preview",config)
        actual={str(r["dimension"]):Decimal(r["value"]) for r in result["rows"]}
        assert not result["truncated"] and actual==expected,(spec["table"],dimension,aggregation)
        checks.append({"dimension":dimension,"aggregation":aggregation,"metric":metric,"filter":filter_,"groups":len(actual),"sumOfGroups":str(sum(actual.values(),Decimal(0)))})
    result={"datasetId":detail["id"],"name":detail["name"],"connectionId":source["id"],"table":spec["table"],"rows":spec["rows"],"created":created,"previewRows":len(preview["rows"]),"checks":checks}
    results.append(result)
    print(json.dumps(result,ensure_ascii=True),flush=True)
(ROOT/"docs/business-datasets-registration.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
