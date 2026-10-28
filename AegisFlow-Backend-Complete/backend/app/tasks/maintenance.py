from app.core.storage import all_docs

def health_snapshot():
    return {'workflows':len(all_docs('workflows')),'incidents':len(all_docs('incidents')),'logs':len(all_docs('logs')),'repairs':len(all_docs('repairs'))}
