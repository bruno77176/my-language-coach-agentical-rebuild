# Title: My Language Coach — Geographic deployment
# Last updated: 2026-05-29
# Scope: Where each runtime component physically lives, and the network paths between them.
# Render: from this directory run `python deployment.py` — outputs rendered/deployment.svg.

from diagrams import Cluster, Diagram, Edge
from diagrams.aws.database import RDS
from diagrams.aws.network import CF
from diagrams.aws.storage import SimpleStorageServiceS3 as S3
from diagrams.aws.compute import EC2
from diagrams.aws.engagement import SimpleEmailServiceSes as SES
from diagrams.onprem.client import Users
from diagrams.saas.cdn import Cloudflare
from diagrams.programming.framework import React

graph_attr = {
    "fontsize": "18",
    "bgcolor": "white",
    "pad": "0.6",
    "splines": "spline",
    "labelloc": "t",
    "label": "My Language Coach — Geographic deployment (2026-05-29)\n"
             "Solid edges = fast EU hops (<30 ms). Dashed = transatlantic (~100 ms).",
}

with Diagram(
    name="",
    show=False,
    filename="rendered/deployment",
    outformat="svg",
    direction="LR",
    graph_attr=graph_attr,
):
    with Cluster("🇨🇭 Switzerland (end user)"):
        user = Users("EU language learner")

    with Cluster("🌍 Global anycast"):
        dns = Cloudflare("Porkbun DNS\n(Cloudflare backbone)")
        edge = CF("Vercel edge POPs\nstatic HTML/JS cached")

    with Cluster("🇸🇪 Stockholm — eu-north-1 / arn"):
        with Cluster("Fly.io"):
            api = EC2("Backend API\nHono, 256 MB, always-on")
        with Cluster("Supabase"):
            db = RDS("Postgres 16\nauth + tables + RLS")
            storage = S3("Storage\naudio cache")

    with Cluster("🇮🇪 Dublin — eu-west-1"):
        email = SES("Resend\n(AWS SES backend)")

    with Cluster("🇺🇸 US east"):
        with Cluster("Vercel functions"):
            vfn = React("Next.js SSR\n(iad1, only for /-routes\nwith headers())")
        ai = EC2("OpenAI\nchat + TTS")
        stt = EC2("Deepgram\nstreaming STT")

    # User to entrypoints
    user >> Edge(label="HTTPS ~20ms") >> edge
    user >> Edge(label="HTTPS+WebSocket ~30ms") >> api
    dns >> Edge(label="resolves to") >> edge

    # Fast EU hops
    api >> Edge(label="~5ms SQL", color="darkgreen") >> db
    api >> Edge(label="~5ms", color="darkgreen") >> storage
    api >> Edge(label="~30ms SMTP", color="darkgreen") >> email

    # Slow transatlantic
    api >> Edge(label="~100ms (chat+TTS)", style="dashed", color="firebrick") >> ai
    api >> Edge(label="~95ms (audio)", style="dashed", color="firebrick") >> stt
    edge >> Edge(label="~100ms SSR fallback", style="dashed", color="firebrick") >> vfn
