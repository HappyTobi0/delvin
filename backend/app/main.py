from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from .models import Vendor, VendorCreate
from .store import store

app = FastAPI(title="Vendor Onboarding Portal")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/vendors", response_model=list[Vendor])
def list_vendors() -> list[Vendor]:
    return store.list()


@app.post("/vendors", response_model=Vendor, status_code=status.HTTP_201_CREATED)
def create_vendor(payload: VendorCreate) -> Vendor:
    return store.add(payload)
