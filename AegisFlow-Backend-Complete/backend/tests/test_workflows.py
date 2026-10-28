from fastapi.testclient import TestClient
from app.main import app

def test_workflows_list():
    with TestClient(app) as client:
        r=client.get('/api/v1/workflows')
        assert r.status_code==200
        data=r.json(); assert data['total'] >= 5
        assert 'retryPolicy' in data['items'][0]

def test_sandbox_execute():
    with TestClient(app) as client:
        r=client.post('/api/v1/workflows/wf-lep-02/execute',json={'payload':{'lead_id':'LD-1'}})
        assert r.status_code==200
        assert r.json()['mode']=='simulation'
