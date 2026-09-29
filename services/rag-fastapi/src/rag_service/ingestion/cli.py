import argparse
from pathlib import Path

from rag_service.ingestion.pipeline import ingest_manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch and prepare an allowlisted legal corpus")
    parser.add_argument("--manifest", type=Path, default=Path("data/manifests/india-patent-mvp.yaml"))
    parser.add_argument("--data-root", type=Path, default=Path("data"))
    parser.add_argument("--offline", action="store_true", help="Regenerate chunks from checksum-verified local downloads")
    arguments = parser.parse_args()

    output = ingest_manifest(arguments.manifest, arguments.data_root, offline=arguments.offline)
    print(f"Corpus prepared: {output}")
    print(f"Review the corpus manifest before indexing or answering: {output / 'corpus-manifest.json'}")


if __name__ == "__main__":
    main()
