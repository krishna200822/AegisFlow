from app.ai.repair_planner import risk_score

def test_non_idempotent_timeout_is_high_risk():
    r=risk_score({'severity':'critical','failureType':'timeout'},{'retryPolicy':{'idempotent':False}},[{'op':'replace'}])
    assert r['score'] >= 80
    assert r['band'] in ('high','critical')
