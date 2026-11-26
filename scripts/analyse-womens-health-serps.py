#!/usr/bin/env python3
"""Summarise who appears in WG's Google Nigeria search-results sample.

The ownership and publisher lists are deliberately kept in this file. They are
small enough to review by hand, and refreshing the JSON should never silently
change what "Nigerian source" or "foreign health publisher" means.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlsplit


DEFAULT_DATA = Path.home() / "Documents/seo-geo-aeo-playbook/strategy/out/wholesomegirlies"

# Nigerian-owned publishers and Nigerian public or university bodies found in
# this sample. Nigerian branches of foreign-owned groups are intentionally not
# included: SYNLAB (Germany), HealthPlus (majority-owned by Ghana's mPharma) and
# Cussons Baby (the UK-based PZ Cussons group).
NIGERIAN_DOMAINS = {
    "agarypharm.com",
    "babymigo.com",
    "c-jhs.com",
    "excarehealth.com",
    "greenbook.nafdac.gov.ng",
    "guardian.ng",
    "healthtracka.com",
    "ir.unilag.edu.ng",
    "lchnigeria.com",
    "mail.annalsofhealthresearch.com",
    "mascothealthcare.com",
    "naija.guru",
    "nairaland.com",
    "nem-health.com",
    "nfhl.naerls.gov.ng",
    "nigeriahealthwatch.com",
    "nordicalagos.org",
    "odysseyofmotherhood.com",
    "omugwo.com.ng",
    "omugwoacademy.com",
    "portal.eclinic.ng",
    "punchng.com",
    "repository.ui.edu.ng",
    "risevest.com",
    "starcare.hospital",
    "stiveshealthcare.com",
    "thebridgeclinic.com",
}

# Foreign sites whose main job in these results is publishing health or
# clinical information. Social networks, shops, general news, journals and
# Nigerian sources are separate categories and do not count here.
FOREIGN_HEALTH_PUBLISHERS = {
    "acog.org", "albertahealthservices.ca", "americanpregnancy.org",
    "aptaclub.co.uk", "babycenter.com", "betterhealth.vic.gov.au",
    "bliss.org.uk", "bounty.com", "breastcancer.org", "bupa.co.uk",
    "cancer.org", "cdc.gov", "childrenshospital.org", "clevelandclinic.org",
    "cuh.nhs.uk", "fertilitynetworkuk.org", "flo.health", "forbeshealth.com",
    "health.clevelandclinic.org", "health.harvard.edu", "healthline.com",
    "healthlinkbc.ca", "hopkinsmedicine.org", "hse.ie", "huggies.co.za",
    "kidshealth.org", "llli.org", "marchofdimes.org", "mayoclinic.org",
    "medlineplus.gov", "mountsinai.org", "my.clevelandclinic.org",
    "nhs.uk", "nichd.nih.gov", "nps.org.au", "nct.org.uk", "parents.com",
    "plannedparenthood.org", "pregnancybirthbaby.org.au", "rcog.org.uk",
    "rush.edu", "stanfordchildrens.org", "thebump.com", "tommys.org",
    "unicef.org", "verywellfamily.com", "verywellhealth.com",
    "webmd.com", "whattoexpect.com", "who.int", "womenshealth.gov",
    "yourfertility.org.au",
}


def domain(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")


def topic_for(keyword: str) -> str:
    """Put each searched phrase into one WG life-stage topic.

    Precedence matters. For example, "postpartum depression" belongs to
    postpartum before the broader pregnancy test runs. A small number of
    animal-vaccination and dog-pregnancy phrases produced by keyword expansion
    are marked out of scope and left out of every total.
    """
    k = keyword.lower()
    if any(x in k for x in ("broiler", "layers vaccination", "dog pregnancy")):
        return "Out of scope"
    if any(x in k for x in (
        "relationship", "situationship", "talking stage", "red flags in a man",
        "red flags to", "non negotiable", "communication in a relationship",
    )):
        return "Relationships"
    if any(x in k for x in (
        "postpartum", "after c section", "after birth", "after delivery",
        "omugwo", "diastasis recti", "pelvic floor",
    )):
        return "Postpartum"
    if any(x in k for x in (
        "baby", "newborn", "infant", "teething", "colic", "weaning",
        "starting solids", "immunisation", "immunization", "vaccination schedule",
        "boy names", "sleep position",
    )):
        return "Parenting"
    if any(x in k for x in (
        "pregnancy", "pregnant", "trimester", "miscarriage", "morning sickness",
        "signs of labour", "antenatal", "prenatal", "due date", "ivf calculator",
        "scan", "ultrasound", "folic acid", "malaria in pregnancy",
    )):
        return "Pregnancy"
    return "Fertility"


def pct(n: int, d: int) -> float:
    return round(100 * n / d, 1) if d else 0.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", type=Path, default=DEFAULT_DATA)
    ap.add_argument("--csv", type=Path, help="write the topic summary CSV")
    args = ap.parse_args()

    serps = json.loads((args.data_dir / "serps.json").read_text())
    clusters = json.loads((args.data_dir / "clusters.json").read_text())
    keywords = json.loads((args.data_dir / "keywords.json").read_text())
    volumes = {row["keyword"]: row.get("volume", 0) for row in keywords}

    all_domains = Counter()
    by_topic = defaultdict(Counter)
    query_domains = {}
    for query, result in serps.items():
        ds = [domain(url) for url in result["urls"]]
        query_domains[query] = set(ds)
        topic = topic_for(query)
        if topic == "Out of scope":
            # Dog-pregnancy and poultry-vaccination phrases from keyword expansion stay out of every total.
            continue
        for host in ds:
            all_domains[host] += 1
            by_topic[topic]["slots"] += 1
            by_topic[topic]["foreign_health"] += host in FOREIGN_HEALTH_PUBLISHERS
            by_topic[topic]["nigerian"] += host in NIGERIAN_DOMAINS
        by_topic[topic]["queries"] += 1

    present_nigerian = sorted(NIGERIAN_DOMAINS & set(all_domains))
    nigerian_slots = sum(all_domains[d] for d in present_nigerian)
    foreign_slots = sum(all_domains[d] for d in FOREIGN_HEALTH_PUBLISHERS)

    cluster_rows = []
    for c in clusters:
        phrases = [c["primary_keyword"], *c.get("secondary_keywords", [])]
        sampled = [q for q in phrases if q in serps]
        hosts = set().union(*(query_domains[q] for q in sampled)) if sampled else set()
        cluster_rows.append({
            "cluster": c["primary_keyword"],
            "topic": topic_for(c["primary_keyword"]),
            "sampled_queries": len(sampled),
            "search_volume": c.get("cluster_volume", volumes.get(c["primary_keyword"], 0)),
            "has_nigerian_source": bool(hosts & NIGERIAN_DOMAINS),
        })

    topic_rows = []
    order = ["Fertility", "Pregnancy", "Postpartum", "Parenting", "Relationships"]
    for topic in order:
        row = by_topic[topic]
        topic_clusters = [c for c in cluster_rows if c["topic"] == topic and c["sampled_queries"]]
        no_ng = [c for c in topic_clusters if not c["has_nigerian_source"]]
        topic_rows.append({
            "topic": topic,
            "queries": row["queries"],
            "result_slots": row["slots"],
            "foreign_health_slots": row["foreign_health"],
            "foreign_health_share_percent": pct(row["foreign_health"], row["slots"]),
            "nigerian_slots": row["nigerian"],
            "nigerian_share_percent": pct(row["nigerian"], row["slots"]),
            "sampled_clusters": len(topic_clusters),
            "clusters_with_no_nigerian_source": len(no_ng),
            "topics_with_no_nigerian_source": "; ".join(c["cluster"] for c in no_ng),
        })

    if args.csv:
        args.csv.parent.mkdir(parents=True, exist_ok=True)
        with args.csv.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=topic_rows[0].keys())
            w.writeheader()
            w.writerows(topic_rows)

    print(f"Queries studied: {sum(r['queries'] for r in topic_rows):,} (out-of-scope phrases excluded)")
    print(f"Result slots studied: {sum(all_domains.values()):,}")
    print(f"Distinct domains: {len(all_domains):,}")
    print(f"Nigerian-owned/public domains: {len(present_nigerian):,}")
    print(f"Nigerian-owned/public result slots: {nigerian_slots:,} ({pct(nigerian_slots, sum(all_domains.values())):.1f}%)")
    print("Nigerian domains: " + ", ".join(f"{d} ({all_domains[d]})" for d in present_nigerian))
    print(f"Foreign health publisher slots: {foreign_slots:,} ({pct(foreign_slots, sum(all_domains.values())):.1f}%)")
    in_scope_clusters = [c for c in cluster_rows if c["sampled_queries"] and c["topic"] != "Out of scope"]
    in_scope_without_ng = [c for c in in_scope_clusters if not c["has_nigerian_source"]]
    print(
        f"Sampled topic clusters with no Nigerian source: {len(in_scope_without_ng):,}/"
        f"{len(in_scope_clusters):,} ({pct(len(in_scope_without_ng), len(in_scope_clusters)):.1f}%)"
    )
    print()
    for row in topic_rows:
        print(
            f"{row['topic']}: {row['queries']} queries, {row['result_slots']} slots, "
            f"{row['foreign_health_slots']} foreign-health slots "
            f"({row['foreign_health_share_percent']:.1f}%), {row['nigerian_slots']} Nigerian slots "
            f"({row['nigerian_share_percent']:.1f}%), "
            f"{row['clusters_with_no_nigerian_source']}/{row['sampled_clusters']} sampled clusters with no Nigerian source"
        )
        if row["topics_with_no_nigerian_source"]:
            print("  No Nigerian source: " + row["topics_with_no_nigerian_source"])

    print("\nMost visible domains:")
    for host, count in all_domains.most_common(15):
        print(f"  {host}: {count}")


if __name__ == "__main__":
    main()
