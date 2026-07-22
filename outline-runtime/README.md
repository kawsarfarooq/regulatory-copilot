# Local Outline runtime

This Docker Compose stack runs Outline with PostgreSQL, Redis, local file storage, Mailpit, and a local Dex identity provider. All published ports bind to `127.0.0.1`.

## Initialize

```powershell
cd outline-runtime
.\Initialize-OutlineConfig.ps1
.\Configure-LocalOidc.ps1
docker compose up -d
docker compose ps
```

Open `http://localhost:3000`, choose **Local Sign-In**, and use the generated `local-admin-credentials.txt`. That credential file and the generated environment files must never be committed.

## Import source documents

Place approved PDFs in `outline-runtime/import/`, install `pypdf`, and convert them to searchable Markdown with page markers:

```powershell
python -m pip install -r requirements.txt
python .\Convert-PdfsToMarkdown.py
```

Import the Markdown files from `import/markdown/` into the appropriate Outline collection. The source PDFs and generated Markdown are ignored by Git by default; document licensing and redistribution should be reviewed separately.

## Operations

```powershell
docker compose up -d
docker compose ps
docker compose logs --tail 100 outline
docker compose stop
```

Do not run `docker compose down -v` unless you intentionally want to delete the database, identity data, and uploaded documents.

## vLLM tunnel

```powershell
.\Start-VllmTunnel.ps1 -SshHost "YOUR_SSH_CONFIG_HOST"
.\Stop-VllmTunnel.ps1
```

The start script checks `http://127.0.0.1:8000/health` before reporting success.
