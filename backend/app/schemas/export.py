from pydantic import BaseModel


class ExportRequest(BaseModel):
    data_type: str  # "cards" | "annotations" | "books"
    format: str  # "markdown" | "pdf" | "csv"
    filters: dict = {}  # {book_id?, date_from?, date_to?, tags?}
