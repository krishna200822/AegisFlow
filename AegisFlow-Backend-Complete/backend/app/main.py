from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.storage import init_db
from app.core.seed import seed_workflows

configure_logging()
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(); seed_workflows(); yield

app=FastAPI(title=settings.app_name,version='1.0.0',description='AegisFlow diagnostics, repair planning, and guarded sandbox recovery API',lifespan=lifespan)
origins=[x.strip() for x in settings.cors_origins.split(',') if x.strip()]
origins.extend(origin for origin in ('http://localhost:5173','http://127.0.0.1:5173') if origin not in origins)
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=['GET','POST','PATCH','DELETE','OPTIONS'],allow_headers=['*'])
app.include_router(api_router,prefix=settings.api_prefix)
@app.get('/')
def root(): return {'name':settings.app_name,'status':'ok','api':settings.api_prefix,'docs':'/docs','mode':'local-sandbox'}
@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    # Keep stack traces in server logs, not in responses sent to clients.
    import logging
    logging.getLogger('aegisflow').exception('Unhandled API error')
    return JSONResponse(status_code=500,content={'detail':'Internal server error. Check the backend terminal logs.'})
