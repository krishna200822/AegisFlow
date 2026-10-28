from app.ai.diagnostics import heuristic

def test_timeout_diagnosis_is_conservative():
    result=heuristic({'failureType':'timeout','errorMessage':'timeout'})
    assert result['source']=='simulated'
    assert 'idempotency' in result['nextStep']
