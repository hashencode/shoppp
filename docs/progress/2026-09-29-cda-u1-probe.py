import sqlite3,time,json
from datetime import datetime,timedelta
from zoneinfo import ZoneInfo
c=sqlite3.connect(':memory:')
c.executescript('CREATE TABLE uv(bucket INTEGER,visitor TEXT,PRIMARY KEY(bucket,visitor)); CREATE TABLE pv(bucket INTEGER,product TEXT,count INTEGER,PRIMARY KEY(bucket,product)); CREATE TABLE dedup(id TEXT PRIMARY KEY,expires INTEGER);')
t=time.perf_counter()
c.executemany('INSERT INTO uv VALUES (?,?)', ((28000000+i//20,'v'+str(i%10000)) for i in range(500000)))
c.executemany('INSERT INTO pv VALUES (?,?,?)', ((28000000+i//10,'p'+str(i%10),5) for i in range(250000)))
c.commit()
q='SELECT COUNT(DISTINCT visitor) FROM uv WHERE bucket >= ? AND bucket < ?'
t=time.perf_counter(); uv=c.execute(q,(28000000,28025000)).fetchone()[0]; elapsed=time.perf_counter()-t
assert uv==10000
zones={}
for zone,date,expected in [('America/New_York','2026-03-08',23),('America/New_York','2026-11-01',25),('Asia/Kolkata','2026-09-29',24),('Asia/Kathmandu','2026-09-29',24)]:
 d=datetime.fromisoformat(date).replace(tzinfo=ZoneInfo(zone)); e=d+timedelta(days=1)
 a,b=int(d.timestamp()),int(e.timestamp()); assert a%60==b%60==0 and (b-a)//3600==expected
 zones[zone+' '+date]={'startMinute':a//60,'endMinute':b//60,'hours':expected}
# AE7, same visitor across days; event-id insert and increments share transaction.
c.executescript('DELETE FROM uv; DELETE FROM pv;')
def ingest(id,bucket,visitor,product,fail=False):
 try:
  with c:
   if not c.execute('INSERT OR IGNORE INTO dedup VALUES (?,?)',(id,999)).rowcount:return
   c.execute('INSERT OR IGNORE INTO uv VALUES (?,?)',(bucket,visitor))
   c.execute('INSERT INTO pv VALUES (?,?,1) ON CONFLICT(bucket,product) DO UPDATE SET count=count+1',(bucket,product))
   if fail:raise RuntimeError()
 except RuntimeError:pass
for i,p in enumerate(['a','a','a','b','b']):ingest(str(i),0,'v1',p)
ingest('5',1440,'v1','a');ingest('5',1440,'v1','a');ingest('rollback',1440,'v2','a',True)
assert c.execute('SELECT COUNT(DISTINCT visitor) FROM uv').fetchone()[0]==1
assert c.execute('SELECT SUM(count) FROM pv').fetchone()[0]==6
assert c.execute('SELECT product,SUM(count) FROM pv GROUP BY product').fetchall()==[('a',4),('b',2)]
print(json.dumps({'rows':{'uv':500000,'pv':250000},'distinctQueryMs':round(elapsed*1000,2),'plan':c.execute('EXPLAIN QUERY PLAN '+q,(28000000,28025000)).fetchall(),'boundaries':zones,'AE7_and_atomic_rollback':'pass'},indent=2))
