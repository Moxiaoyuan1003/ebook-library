import io
import os
import zipfile

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/export")
def export_backup():
    zip_path = "backup.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Database
        db_path = "data/ebook.db"
        if os.path.exists(db_path):
            zf.write(db_path, "ebook.db")
        # Covers
        covers_dir = "data/covers"
        if os.path.exists(covers_dir):
            for f in os.listdir(covers_dir):
                fpath = os.path.join(covers_dir, f)
                if os.path.isfile(fpath):
                    zf.write(fpath, f"covers/{f}")
        # .env
        if os.path.exists(".env"):
            zf.write(".env", ".env")
    return FileResponse(zip_path, filename="ebook-library-backup.zip")


@router.post("/import")
async def import_backup(file: UploadFile = File(...)):
    content = await file.read()
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        zf.extractall(".")
    return {"ok": True, "message": "备份已恢复，请重启应用"}
