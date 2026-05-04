"""CLI entry point for the backend server."""

import argparse


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Ebook Library Backend Server")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--data-dir", default="", help="Data directory for SQLite and storage")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    # Set data dir in config BEFORE importing app modules
    if args.data_dir:
        import os
        os.environ["DATA_DIR"] = args.data_dir

    from app.core.config import settings
    if args.data_dir:
        settings.DATA_DIR = args.data_dir

    # Initialize database (creates SQLite DB and tables if needed)
    from app.core.database import init_database
    init_database()

    # Start uvicorn
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
