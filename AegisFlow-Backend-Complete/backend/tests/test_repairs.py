from app.ai.repair_planner import propose

def test_repair_proposal_preserves_source_payload():
    incident={'id':'INC-1','workflowId':'wf-lep-02','failureType':'schema_mismatch','severity':'high','payload':{'leadId':'LD-1','email_address':'a@b.com'},'status':'open'}
    workflow={'id':'wf-lep-02','name':'Lead Enrichment','inputSchema':{'lead_id':'string','email':'string'},'idField':'lead_id','idAlias':'leadId','numberField':'employees','retryPolicy':{'maxAttempts':3,'idempotent':True}}
    result=propose(incident,workflow,{'likelyCause':'schema mismatch'})
    assert result['originalPayload']==incident['payload']
    assert result['id'].startswith('RP-')
    assert 'risk' in result
