from collections import defaultdict

def cluster_incidents(incidents: list[dict]) -> list[dict]:
    groups=defaultdict(list)
    for inc in incidents:
        key=(inc.get('failureType','unknown'), str(inc.get('errorMessage','')).split(':')[0][:100])
        groups[key].append(inc.get('id'))
    return [{'id':f'cluster-{i+1}','failureType':k[0],'signature':k[1],'count':len(v),'incidentIds':v} for i,(k,v) in enumerate(sorted(groups.items(),key=lambda kv:-len(kv[1])))]
