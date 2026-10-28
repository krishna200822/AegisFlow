from collections import Counter
from app.core.storage import all_docs

def get_metrics():
    incidents=all_docs('incidents'); executions=all_docs('executions'); workflows=all_docs('workflows'); repairs=all_docs('repairs')
    resolved=[i for i in incidents if i.get('status')=='resolved']
    active=[i for i in incidents if i.get('status')!='resolved']
    retries=[e for e in executions if e.get('isRetry')]
    successful=sum(1 for e in retries if e.get('outcome')=='success')
    durations=[e.get('durationMs',0) for e in executions if isinstance(e.get('durationMs'),(int,float))]
    counts=Counter(i.get('failureType','unknown') for i in incidents)
    return {'workflowsMonitored':len(workflows),'activeIncidents':len(active),'successfulRecoveries':successful,'failedRecoveries':len(retries)-successful,'recoverySuccessRate':successful/len(retries) if retries else 0,'totalIncidents':len(incidents),'healedIncidents':len(resolved),'healingRate':len(resolved)/len(incidents) if incidents else 0,'meanTimeToRecoverySeconds':round(sum(durations)/len(durations)/1000,2) if durations else None,'executionVolume':len(executions),'repairProposals':len(repairs),'failureClusters':[{'name':k,'value':v} for k,v in counts.items()]}

def get_clusters():
    counts={}
    for i in all_docs('incidents'):
        key=i.get('failureType','unknown'); counts[key]=counts.get(key,0)+1
    return {'items':[{'id':k,'failureType':k,'name':k.replace('_',' ').title(),'count':v} for k,v in sorted(counts.items(),key=lambda x:-x[1])],'total':sum(counts.values())}
