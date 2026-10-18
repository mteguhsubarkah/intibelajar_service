#!/usr/bin/env python3
"""Offline consistency checks for docs/backend-architecture.

This is NOT an official OpenAPI validator. It checks what this package can
check without network access (PyYAML is the only dependency):

  * openapi.yaml structure: $refs, operationIds, path parameters, security,
    responses, discriminators, required-vs-properties, unused components;
  * every example in openapi.yaml against its schema (JSON Schema subset);
  * ERD relationships vs DDL foreign keys and the stated table count (04);
  * enum values in the DDL CHECKs vs openapi.yaml;
  * state machine (05) vs the DDL and openapi.yaml;
  * the operation catalogue (09 §7) vs openapi.yaml, and every /v1 path or
    "METHOD /v1/..." mentioned anywhere in the documents;
  * the shipped frontend's adapter endpoints and enums vs openapi.yaml;
  * error codes (09 §3) vs openapi.yaml and every "`NNN CODE`" mention;
  * CSRF and Idempotency-Key rules on every authenticated mutation;
  * invariant, transition and acceptance-scenario coverage in 11;
  * eligibility and uncertainty codes in 06 vs openapi.yaml;
  * every relative Markdown link and #anchor (GitHub slug rules).

Usage (from the repository root or anywhere):
  python docs/backend-architecture/validate-spec.py
  python docs/backend-architecture/validate-spec.py --write [--run-consumer-suite]

--write                 also writes verification.json next to this script
--run-consumer-suite    also runs `npm run test:backend` and records the result
--self-test             proves each check can fail: copies the documents to a temporary
                        directory, applies one targeted mutation at a time and expects
                        exactly the listed checks to fail
Exit code is 1 when any check fails.
"""
import datetime
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
METHODS = ("get", "put", "post", "delete", "patch", "head", "options", "trace")
BLUEPRINT_ONLY_CODES = {"GUEST_ALREADY_CLAIMED"}  # quoted from blueprint A05/T02, not served
ALLOWED_UNUSED = {"schemas/LegacyIntakeRead"}      # reference shape for the unserved L7

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

results = []


def check(cid, title, problems, warnings=(), info=None):
    status = "fail" if problems else ("warn" if warnings else "pass")
    entry = {"id": cid, "title": title, "status": status}
    if problems:
        entry["problems"] = list(problems)
    if warnings:
        entry["warnings"] = list(warnings)
    if info is not None:
        entry["info"] = info
    results.append(entry)


def read(name):
    with io.open(os.path.join(HERE, name), encoding="utf-8") as fh:
        return fh.read()


def read_repo(rel):
    path = os.path.join(REPO, rel)
    if not os.path.exists(path):
        return None
    with io.open(path, encoding="utf-8") as fh:
        return fh.read()


def normalise(node):
    """YAML 1.1 turns some scalars into dates; JSON never does."""
    if isinstance(node, dict):
        return {str(k): normalise(v) for k, v in node.items()}
    if isinstance(node, list):
        return [normalise(v) for v in node]
    if isinstance(node, datetime.datetime):
        return node.isoformat().replace("+00:00", "Z")
    if isinstance(node, datetime.date):
        return node.isoformat()
    return node


MD_FILES = sorted(f for f in os.listdir(HERE) if re.match(r"^\d\d-.*\.md$", f))
DOCS = {f: read(f) for f in MD_FILES}
SPEC = normalise(yaml.safe_load(read("openapi.yaml")))


def strip_code_fences(text):
    out, fenced = [], False
    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            fenced = not fenced
            out.append("")
            continue
        out.append("" if fenced else line)
    return "\n".join(out)


def section(text, start_heading, stop_pattern=r"^## "):
    lines = text.split("\n")
    out, inside = [], False
    for line in lines:
        if line.startswith(start_heading):
            inside = True
            continue
        if inside and re.match(stop_pattern, line):
            break
        if inside:
            out.append(line)
    return "\n".join(out)


def code_block(text, lang):
    blocks = re.findall(r"```" + re.escape(lang) + r"\n(.*?)```", text, re.S)
    return blocks


# --------------------------------------------------------------- $ref helpers
def resolve(ref):
    if not ref.startswith("#/"):
        raise KeyError("non-local ref " + ref)
    node = SPEC
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def deref(node):
    seen = 0
    while isinstance(node, dict) and "$ref" in node and seen < 20:
        try:
            node = resolve(node["$ref"])
        except (KeyError, TypeError, IndexError):
            return {}  # reported by OAS-1
        seen += 1
    return node


def walk(node, fn, path="#"):
    fn(node, path)
    if isinstance(node, dict):
        for k, v in node.items():
            walk(v, fn, path + "/" + str(k).replace("~", "~0").replace("/", "~1"))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, fn, path + "/" + str(i))


def operations():
    for path, item in SPEC.get("paths", {}).items():
        for method in METHODS:
            if method in item:
                yield path, method, item[method], item


def schema(name):
    return SPEC["components"]["schemas"][name]


def enum_of(name):
    return list(schema(name)["enum"])


# ===================================================================== OpenAPI
def check_openapi_structure():
    problems, warnings = [], []
    if not str(SPEC.get("openapi", "")).startswith("3.1"):
        problems.append("openapi version is not 3.1.x")
    for key in ("title", "version"):
        if key not in SPEC.get("info", {}):
            problems.append("info." + key + " missing")

    refs = []

    def collect(node, path):
        if isinstance(node, dict) and isinstance(node.get("$ref"), str):
            refs.append((path, node["$ref"]))

    walk(SPEC, collect)
    for path, ref in refs:
        try:
            resolve(ref)
        except Exception:
            problems.append("unresolved $ref " + ref + " at " + path)

    op_ids = {}
    schemes = set(SPEC.get("components", {}).get("securitySchemes", {}))
    declared_tags = {t["name"] for t in SPEC.get("tags", [])}
    for req in SPEC.get("security", []):
        for name in req:
            if name not in schemes:
                problems.append("root security uses unknown scheme " + name)
    count = 0
    for path, method, op, item in operations():
        count += 1
        where = method.upper() + " " + path
        oid = op.get("operationId")
        if not oid:
            problems.append(where + ": missing operationId")
        elif oid in op_ids:
            problems.append(where + ": duplicate operationId " + oid + " (also " + op_ids[oid] + ")")
        else:
            op_ids[oid] = where
        for tag in op.get("tags", []):
            if tag not in declared_tags:
                warnings.append(where + ": tag '" + tag + "' not declared")
        for req in op.get("security", []):
            for name in req:
                if name not in schemes:
                    problems.append(where + ": unknown security scheme " + name)
        params = [deref(p) for p in item.get("parameters", [])] + [deref(p) for p in op.get("parameters", [])]
        seen = set()
        for p in params:
            key = (p.get("name"), p.get("in"))
            if key in seen:
                problems.append(where + ": duplicate parameter " + str(key))
            seen.add(key)
            if p.get("in") not in ("query", "header", "path", "cookie"):
                problems.append(where + ": parameter " + str(p.get("name")) + " has invalid 'in'")
            if "schema" not in p and "content" not in p:
                problems.append(where + ": parameter " + str(p.get("name")) + " has no schema")
        templ = set(re.findall(r"{([^}]+)}", path))
        declared = {p["name"] for p in params if p.get("in") == "path"}
        for name in templ - declared:
            problems.append(where + ": path parameter {" + name + "} not declared")
        for name in declared - templ:
            problems.append(where + ": path parameter " + name + " not in template")
        for p in params:
            if p.get("in") == "path" and p.get("required") is not True:
                problems.append(where + ": path parameter " + p["name"] + " must be required")
        responses = op.get("responses", {})
        if not responses:
            problems.append(where + ": no responses")
        for code, resp in responses.items():
            if not re.match(r"^([1-5]\d\d|[1-5]XX|default)$", str(code)):
                problems.append(where + ": invalid response code " + str(code))
            resp = deref(resp)
            if "description" not in resp:
                problems.append(where + " " + str(code) + ": response without description")
        body = op.get("requestBody")
        if body is not None and not deref(body).get("content"):
            problems.append(where + ": requestBody without content")

    # discriminators and required-vs-properties in every schema object
    def schema_rules(node, path):
        if not isinstance(node, dict):
            return
        if "discriminator" in node:
            prop = node["discriminator"].get("propertyName")
            members = node.get("oneOf") or node.get("anyOf") or []
            values = set()
            for m in members:
                m = deref(m)
                if prop not in m.get("required", []):
                    problems.append(path + ": discriminator '" + prop + "' not required in a member")
                pdef = m.get("properties", {}).get(prop, {})
                if "const" in pdef:
                    values.add(pdef["const"])
                values.update(pdef.get("enum", []))
            for key, target in node["discriminator"].get("mapping", {}).items():
                if key not in values:
                    problems.append(path + ": mapping key " + key + " matches no member const/enum")
                try:
                    resolve(target)
                except Exception:
                    problems.append(path + ": mapping target " + target + " unresolved")
        props = node.get("properties")
        req = node.get("required")
        if isinstance(props, dict) and isinstance(req, list) and "if" not in path.split("/")[-1:]:
            for r in req:
                if r not in props:
                    (problems if node.get("additionalProperties") is False else warnings).append(
                        path + ": required '" + r + "' not in properties")

    walk(SPEC.get("components", {}).get("schemas", {}), schema_rules, "#/components/schemas")
    walk(SPEC.get("paths", {}), schema_rules, "#/paths")

    used = {ref for _, ref in refs}
    for kind in ("schemas", "parameters", "responses", "headers", "examples"):
        for name in SPEC.get("components", {}).get(kind, {}):
            key = kind + "/" + name
            if "#/components/" + key not in used and key not in ALLOWED_UNUSED:
                warnings.append("unused component " + key)
    check("OAS-1", "openapi.yaml structure (refs, operationIds, parameters, security, responses, discriminators)",
          problems, warnings, {"operations": count, "operationIds": len(op_ids), "refs": len(refs)})
    return count


# ------------------------------------------------- JSON Schema subset validator
FORMATS = {
    "uuid": r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    "date-time": r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$",
    "date": r"^\d{4}-\d{2}-\d{2}$",
    "email": r"^[^@\s]+@[^@\s]+\.[^@\s]+$",
    "uri": r"^[A-Za-z][A-Za-z0-9+.-]*:",
}


def type_ok(value, t):
    if t == "null":
        return value is None
    if t == "boolean":
        return isinstance(value, bool)
    if t == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if t == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if t == "string":
        return isinstance(value, str)
    if t == "array":
        return isinstance(value, list)
    if t == "object":
        return isinstance(value, dict)
    return False


def same(a, b):
    return type(a) is type(b) and a == b if isinstance(a, bool) or isinstance(b, bool) else a == b


def validate(value, sch, path, errors):
    if "$ref" in sch:
        try:
            target = resolve(sch["$ref"])
        except (KeyError, TypeError, IndexError):
            errors.append(path + ": unresolved $ref " + str(sch["$ref"]))
            return
        validate(value, target, path, errors)
    t = sch.get("type")
    if t is not None:
        types = t if isinstance(t, list) else [t]
        if not any(type_ok(value, x) for x in types):
            errors.append(path + ": expected " + "/".join(types))
            return
    if "const" in sch and not same(value, sch["const"]):
        errors.append(path + ": must equal " + repr(sch["const"]))
    if "enum" in sch and not any(same(value, e) for e in sch["enum"]):
        errors.append(path + ": " + repr(value) + " not in enum")
    if isinstance(value, str):
        if "minLength" in sch and len(value) < sch["minLength"]:
            errors.append(path + ": shorter than " + str(sch["minLength"]))
        if "maxLength" in sch and len(value) > sch["maxLength"]:
            errors.append(path + ": longer than " + str(sch["maxLength"]))
        if "pattern" in sch and not re.search(sch["pattern"], value):
            errors.append(path + ": does not match pattern")
        fmt = sch.get("format")
        if fmt in FORMATS and not re.search(FORMATS[fmt], value):
            errors.append(path + ": not a valid " + fmt)
    if type_ok(value, "number"):
        if "minimum" in sch and value < sch["minimum"]:
            errors.append(path + ": below minimum")
        if "maximum" in sch and value > sch["maximum"]:
            errors.append(path + ": above maximum")
    if isinstance(value, list):
        if "minItems" in sch and len(value) < sch["minItems"]:
            errors.append(path + ": fewer than " + str(sch["minItems"]) + " items")
        if "maxItems" in sch and len(value) > sch["maxItems"]:
            errors.append(path + ": more than " + str(sch["maxItems"]) + " items")
        if sch.get("uniqueItems"):
            dumped = [json.dumps(v, sort_keys=True) for v in value]
            if len(set(dumped)) != len(dumped):
                errors.append(path + ": items not unique")
        if "items" in sch:
            for i, v in enumerate(value):
                validate(v, sch["items"], path + "[" + str(i) + "]", errors)
    if isinstance(value, dict):
        props = sch.get("properties", {})
        for r in sch.get("required", []):
            if r not in value:
                errors.append(path + ": missing required '" + r + "'")
        for k, v in value.items():
            if k in props:
                validate(v, props[k], path + "." + k, errors)
            else:
                extra = sch.get("additionalProperties", True)
                if extra is False:
                    errors.append(path + ": unexpected property '" + k + "'")
                elif isinstance(extra, dict):
                    validate(v, extra, path + "." + k, errors)
        if "minProperties" in sch and len(value) < sch["minProperties"]:
            errors.append(path + ": fewer than " + str(sch["minProperties"]) + " properties")
        if "maxProperties" in sch and len(value) > sch["maxProperties"]:
            errors.append(path + ": more than " + str(sch["maxProperties"]) + " properties")
    for sub in sch.get("allOf", []):
        validate(value, sub, path, errors)
    if "anyOf" in sch:
        if not any(not _errs(value, s, path) for s in sch["anyOf"]):
            errors.append(path + ": matches no anyOf branch")
    if "oneOf" in sch:
        matches = sum(1 for s in sch["oneOf"] if not _errs(value, s, path))
        if matches != 1:
            errors.append(path + ": matches " + str(matches) + " oneOf branches (expected 1)")
    if "if" in sch:
        if not _errs(value, sch["if"], path):
            if "then" in sch:
                validate(value, sch["then"], path, errors)
        elif "else" in sch:
            validate(value, sch["else"], path, errors)


def _errs(value, sch, path):
    errs = []
    validate(value, sch, path, errs)
    return errs


def check_examples():
    problems, count = [], 0

    def media_examples(media, where):
        nonlocal count
        sch = media.get("schema")
        if sch is None:
            return
        found = []
        if "example" in media:
            found.append(("example", media["example"]))
        for name, ex in media.get("examples", {}).items():
            ex = deref(ex)
            if "value" in ex:
                found.append((name, ex["value"]))
        for name, value in found:
            count += 1
            errs = _errs(value, sch, "$")
            problems.extend(where + " example '" + name + "': " + e for e in errs)

    for path, method, op, _ in operations():
        where = method.upper() + " " + path
        body = op.get("requestBody")
        if body:
            for mt, media in deref(body).get("content", {}).items():
                media_examples(media, where + " request " + mt)
        for code, resp in op.get("responses", {}).items():
            if "$ref" in resp:
                continue  # shared responses are checked once below
            for mt, media in resp.get("content", {}).items():
                media_examples(media, where + " " + str(code) + " " + mt)
    for name, resp in SPEC.get("components", {}).get("responses", {}).items():
        for mt, media in resp.get("content", {}).items():
            media_examples(media, "components/responses/" + name)

    # semantic INV-09 check on examples: SPAN quotes equal the response substring
    for name, ex in SPEC.get("components", {}).get("examples", {}).items():
        value = ex.get("value", {})
        if isinstance(value, dict) and "attempt" in value and "diagnosisRun" in value:
            text = value["attempt"].get("response", {}).get("text", "")
            for ev in value["diagnosisRun"].get("evidence", []):
                for ref in ev.get("refs", []):
                    if ref.get("kind") == "SPAN" and text[ref["start"]:ref["end"]] != ref.get("quote"):
                        problems.append("example " + name + ": SPAN quote does not match response text (INV-09)")
    check("OAS-2", "Examples validate against their schemas (JSON Schema subset) and cite real spans",
          problems, (), {"examplesChecked": count})


# ========================================================= 04: ERD vs DDL
def parse_ddl():
    text = DOCS["04-postgresql-erd.md"]
    sql = "\n".join(code_block(text, "sql"))
    tables, fks, checks = [], set(), {}
    for m in re.finditer(r"CREATE TABLE (\w+) \((.*?)\n\);", sql, re.S):
        name, body = m.group(1), m.group(2)
        tables.append(name)
        for line in body.split("\n"):
            for parent in re.findall(r"REFERENCES (\w+)\s*\(", line):
                fks.add((name, parent))
            cm = re.match(r"\s*(\w+)\s+.*?CHECK \(\1 IN \(([^)]*)\)\)", line)
            if cm:
                checks[(name, cm.group(1))] = re.findall(r"'([^']*)'", cm.group(2))
    for m in re.finditer(r"ALTER TABLE (\w+)\s+ADD CONSTRAINT \w+\s+FOREIGN KEY \([^)]*\) REFERENCES (\w+)", sql, re.S):
        fks.add((m.group(1), m.group(2)))
    return text, tables, fks, checks


def check_erd():
    text, tables, fks, _ = parse_ddl()
    problems = []
    stated = re.search(r"cover the (\d+) tables", text)
    if not stated:
        problems.append("table count statement not found")
    elif int(stated.group(1)) != len(tables):
        problems.append("text says " + stated.group(1) + " tables, DDL defines " + str(len(tables)))
    if len(set(tables)) != len(tables):
        problems.append("duplicate CREATE TABLE")
    rels, nofk, entities = set(), set(), set()
    for block in code_block(text, "mermaid"):
        if "erDiagram" not in block:
            continue
        for a, b, label in re.findall(r"^\s*(\w+)\s+[|}o{.\-]+\s+(\w+)\s*:\s*\"([^\"]*)\"", block, re.M):
            entities.update((a, b))
            (nofk if "(no FK)" in label else rels).add(frozenset((a, b)))
    for e in sorted(entities - set(tables)):
        problems.append("ERD entity without a table: " + e)
    for t in sorted(set(tables) - entities):
        problems.append("table missing from every ERD: " + t)
    fk_pairs = {frozenset(p) for p in fks}
    for pair in sorted(fk_pairs - rels, key=sorted):
        problems.append("FK without ERD relationship: " + " - ".join(sorted(pair)))
    for pair in sorted(rels - fk_pairs, key=sorted):
        problems.append("ERD relationship without FK: " + " - ".join(sorted(pair)))
    for pair in sorted(nofk & fk_pairs, key=sorted):
        problems.append("relationship labelled '(no FK)' but an FK exists: " + " - ".join(sorted(pair)))
    check("DB-1", "ERD relationships match DDL foreign keys; table count matches the text (04)", problems, (),
          {"tables": len(tables), "foreignKeyPairs": len(fk_pairs), "erdRelationships": len(rels),
           "documentedNoFk": len(nofk)})
    return tables


ENUM_MAP = {
    "LearnerStatus": ("learner", "status"),
    "AgeBand": ("learner", "age_band"),
    "AgeBandSource": ("learner", "age_band_source"),
    "ConsentPurpose": ("consent_record", "purpose"),
    "ConsentStatus": ("consent_record", "status"),
    "ConsentMethod": ("consent_record", "method"),
    "SessionKind": ("learning_session", "kind"),
    "SessionOrigin": ("learning_session", "origin"),
    "SessionState": ("learning_session", "state"),
    "SessionOutcome": ("learning_session", "outcome"),
    "ResumeState": ("learning_session", "resume_state"),
    "SessionItemStatus": ("session_item", "status"),
    "LessonAssignmentStatus": ("lesson_assignment", "status"),
    "AttemptKind": ("question_attempt", "kind"),
    "Assistance": ("question_attempt", "assistance"),
    "Verdict": ("question_attempt", "verdict"),
    "AttemptSource": ("question_attempt", "source"),
    "RunStatus": ("diagnosis_run", "status"),
    "EvidenceStatus": ("diagnosis_run", "evidence_status"),
    "FinalVerdict": ("diagnosis_run", "verdict"),
    "RunPurpose": ("diagnosis_run", "purpose"),
    "Engine": ("diagnosis_run", "engine"),
    "Classification": ("concept_evidence", "classification"),
    "EvidenceSource": ("concept_evidence", "source"),
    "ReportReason": ("diagnosis_report", "reason"),
    "ReportStatus": ("diagnosis_report", "status"),
    "ItemType": ("question_revision", "item_type"),
    "QuestionVisibility": ("question", "visibility"),
    "Phase": ("topic", "phase"),
    "MasteryStatus": ("mastery_state", "status"),
    "Exploration": ("mastery_state", "exploration"),
    "NeedsReviewReason": ("mastery_state", "needs_review_reason"),
    "ProgressEventType": ("progress_event", "type"),
    "TutorRole": ("tutor_message", "role"),
    "TutorMessageStatus": ("tutor_message", "status"),
    "TutorIntent": ("tutor_message", "intent"),
    "IntakeStatus": ("question_intake", "status"),
    "IntakeInputMode": ("question_intake", "input_mode"),
}


def check_enums():
    _, _, _, checks = parse_ddl()
    problems = []
    for name, (table, column) in sorted(ENUM_MAP.items()):
        ddl = checks.get((table, column))
        if ddl is None:
            problems.append("no CHECK list found for " + table + "." + column)
            continue
        api = enum_of(name)
        if set(ddl) != set(api):
            problems.append(name + " != " + table + "." + column + ": only in DDL " +
                            str(sorted(set(ddl) - set(api))) + ", only in API " + str(sorted(set(api) - set(ddl))))
    check("DB-2", "DDL CHECK enumerations equal openapi.yaml enums", problems, (), {"enumsCompared": len(ENUM_MAP)})


# =============================================================== 05 vs others
def check_state_machine():
    text = DOCS["05-learning-state-machine.md"]
    problems = []
    states_api = set(enum_of("SessionState"))
    outcomes_api = set(enum_of("SessionOutcome"))
    actions_api = set(enum_of("AllowedAction"))
    diagram = [b for b in code_block(text, "mermaid") if "stateDiagram" in b]
    if not diagram:
        problems.append("no stateDiagram in 05")
        check("SM-1", "State machine (05) vs DDL and openapi.yaml", problems)
        return
    states, outcomes = set(), set()
    for a, b, label in re.findall(r"^\s*(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.*))?$", diagram[0], re.M):
        states.update(s for s in (a, b) if s != "[*]")
        outcomes.update(re.findall(r"\[([A-Z_]+)\]", label or ""))
    for s in sorted(states - states_api):
        problems.append("diagram state not in SessionState: " + s)
    for s in sorted(states_api - states - {"ABANDONED", "EXPIRED"}):
        problems.append("SessionState missing from diagram: " + s)
    for s in ("ABANDONED", "EXPIRED"):
        if "`" + s + "`" not in text:
            problems.append(s + " not described in 05")
    for o in sorted(outcomes - outcomes_api):
        problems.append("diagram outcome not in SessionOutcome: " + o)
    for o in sorted(outcomes_api):
        if "`" + o + "`" not in text and o not in outcomes:
            problems.append("SessionOutcome never used in 05: " + o)

    cmd_table = section(text, "### 4.1")
    commands = set()
    for row in re.findall(r"^\| ((?:`[A-Z_]+`(?:, )?)+) \|", cmd_table, re.M):
        commands.update(re.findall(r"`([A-Z_]+)`", row))
    if commands - {"CREATE"} != actions_api:
        problems.append("05 §4.1 commands != AllowedAction: only in 05 " + str(sorted(commands - {"CREATE"} - actions_api)) +
                        ", only in API " + str(sorted(actions_api - commands)))

    ids = re.findall(r"^\| (E-\d\d) \|", text, re.M)
    expected = ["E-%02d" % i for i in range(1, len(ids) + 1)]
    if ids != expected:
        problems.append("transition IDs not unique and contiguous: " + ", ".join(ids))
    allowed_tokens = (states_api | actions_api | {"CREATE"} | outcomes_api | set(enum_of("Verdict")) |
                      set(enum_of("SessionKind")))
    for row in re.findall(r"^\| E-\d\d \|.*$", text, re.M):
        cells = [c.strip() for c in row.strip().strip("|").split("|")]
        if len(cells) < 6:
            problems.append("malformed transition row: " + row[:60])
            continue
        for cell in (cells[2], cells[5]):
            for tok in re.findall(r"`([A-Z][A-Z_]+)`", cell):
                if tok not in allowed_tokens:
                    problems.append(cells[0] + ": unknown state/command token " + tok)
    _, _, _, checks = parse_ddl()
    if set(checks.get(("learning_session", "resume_state"), [])) != {"DIAGNOSING", "VERIFYING"}:
        problems.append("resume_state CHECK differs from 05 (DIAGNOSING, VERIFYING)")
    check("SM-1", "State machine (05): states, outcomes, commands and transition table vs DDL and openapi.yaml",
          problems, (), {"diagramStates": len(states), "transitions": len(ids), "commands": len(commands)})
    return ids


# ======================================================= endpoints and docs
def api_ops():
    return {(m.upper(), p) for p, m, _, _ in operations()}


def norm_path(p):
    return re.sub(r"{[^}]*}", "{}", p.rstrip("/."))


def path_matches(mention, template):
    """A mention matches a template segment by segment; {x} in either matches anything."""
    a, b = norm_path(mention).split("/"), norm_path(template).split("/")
    return len(a) == len(b) and all(x == y or "{}" in (x, y) for x, y in zip(a, b))


def check_catalogue(op_count):
    text = DOCS["09-api-design.md"]
    cat = section(text, "## 7. Operation catalogue")
    rows = set(re.findall(r"^\| `(GET|POST|PUT|PATCH|DELETE)` \| `(/v1/[^`]*)` \|", cat, re.M))
    api = api_ops()
    problems = []
    for m, p in sorted(rows - api):
        problems.append("in 09 §7 but not in openapi.yaml: " + m + " " + p)
    for m, p in sorted(api - rows):
        problems.append("in openapi.yaml but not in 09 §7: " + m + " " + p)
    check("API-1", "Operation catalogue (09 §7) equals openapi.yaml", problems, (),
          {"catalogueRows": len(rows), "openapiOperations": op_count})


def check_mentions():
    api = api_ops()
    problems, mentions = [], 0
    for name, text in DOCS.items():  # code blocks included: diagrams name endpoints too
        for m in re.finditer(r"/v1/[A-Za-z0-9_\-{}/.]*", text):
            nxt = text[m.end():m.end() + 1]
            if nxt in ("*", "…"):
                continue
            p = m.group(0).rstrip(".")
            if p.endswith("/"):
                continue
            mentions += 1
            if not any(path_matches(p, t) for _, t in api):
                problems.append(name + ": path not in openapi.yaml: " + p)
        for m in re.finditer(r"\b(GET|POST|PUT|PATCH|DELETE) (/v1/[A-Za-z0-9_\-{}/]*)", text):
            if text[m.end():m.end() + 1] in ("*", "…"):
                continue
            if not any(meth == m.group(1) and path_matches(m.group(2), t) for meth, t in api):
                problems.append(name + ": operation not in openapi.yaml: " + m.group(1) + " " + m.group(2))
    check("API-2", "Every /v1 path and 'METHOD /v1/...' mentioned in 01-12 exists in openapi.yaml",
          sorted(set(problems)), (), {"pathMentions": mentions})


def check_frontend_contract():
    problems, warnings = [], []
    lb = read_repo("src/services/learningBackend.ts")
    lp = read_repo("src/composables/useLearnerProgress.ts")
    tutor = read_repo("src/services/tutor.ts")
    if lb is None or lp is None:
        check("FE-1", "Shipped frontend adapters vs openapi.yaml", [],
              ["frontend sources not found under " + REPO + "; check skipped"])
        return
    api = api_ops()
    endpoints = dict(re.findall(r"(\w+): '(/v1/[^']+)'", lb))
    for key, path in sorted(endpoints.items()):
        if ("POST", path) not in api:
            problems.append("adapter '" + key + "' calls POST " + path + ", not in openapi.yaml")
    if "diagnosis" in endpoints and ("GET", endpoints["diagnosis"] + "/{diagnosisRunId}") not in api:
        problems.append("diagnosis polling GET " + endpoints["diagnosis"] + "/{id} not in openapi.yaml")
    if "'/v1/me/progress'" in lp and ("GET", "/v1/me/progress") not in api:
        problems.append("GET /v1/me/progress not in openapi.yaml")

    def ts_union(pattern, src):
        m = re.search(pattern, src or "")
        return [v.strip().strip("'\"") for v in m.group(1).split("|")] if m else None

    def legacy_prop(schema_name, prop):
        sch = schema(schema_name)
        for part in [sch] + [deref(p) for p in sch.get("allOf", [])]:
            if prop in part.get("properties", {}):
                return deref(part["properties"][prop])
        return {}

    pairs = [
        ("DiagnosisRun.status", ts_union(r"status: ((?:'[a-z_]+' \| )+'[a-z_]+');", lb),
         [v for v in legacy_prop("LegacyDiagnosisRun", "status").get("enum", [])]),
        ("CoreReason.state", ts_union(r"state: ('ok' \| 'gap' \| 'rest')", lb),
         legacy_prop("LegacyCoreReason", "state").get("enum")),
        ("check kind", ts_union(r"kind: ('check' \| 'practice' \| 'retry_original')", lb),
         legacy_prop("LegacyCheckRequest", "kind").get("enum")),
        ("solution reason", ts_union(r"reason: ((?:'[a-z_]+' \| )+'[a-z_]+')", lb),
         legacy_prop("LegacySolutionRequest", "reason").get("enum")),
        ("auth provider", ts_union(r"provider: ('google' \| 'email')", lb),
         legacy_prop("StartAuthRequest", "provider").get("enum")),
        ("TutorScript", ts_union(r"export type TutorScript = ((?:\"[a-z]+\" \| )+\"[a-z]+\");", tutor),
         legacy_prop("LegacyTutorRequest", "script").get("enum")),
        ("snapshot exploration", ts_union(r"exploration:\s*('UNVISITED'\s*\|\s*'VISITED')", lp), enum_of("Exploration")),
        ("snapshot mastery", ts_union(r"mastery:\s*('NOT_ASSESSED'\s*\|\s*'DEVELOPING'\s*\|\s*'DEMONSTRATED')", lp),
         enum_of("MasteryStatus")),
    ]
    compared = 0
    for label, ts_values, api_values in pairs:
        if ts_values is None:
            warnings.append(label + ": pattern not found in the frontend source")
            continue
        compared += 1
        if set(ts_values) != set(api_values or []):
            problems.append(label + ": frontend " + str(ts_values) + " vs openapi.yaml " + str(api_values))
    check("FE-1", "Shipped frontend adapter endpoints and enums are covered by openapi.yaml", problems, warnings,
          {"adapterEndpoints": len(endpoints), "enumsCompared": compared})


def check_mutation_rules():
    """09 §2/§4: authenticated mutations need X-CSRF-Token; authenticated POST commands need Idempotency-Key."""
    problems = []
    for path, method, op, item in operations():
        if method not in ("post", "put", "patch", "delete") or "legacy" in op.get("tags", []):
            continue
        sec = op.get("security", SPEC.get("security", []))
        cookie_required = sec and all("sessionCookie" in req for req in sec)
        if not cookie_required:
            continue  # public or token-gated operations
        where = method.upper() + " " + path
        if not all("csrfToken" in req for req in sec):
            problems.append(where + ": authenticated mutation without csrfToken")
        params = [deref(p) for p in item.get("parameters", []) + op.get("parameters", [])]
        has_key = any(p.get("name") == "Idempotency-Key" and p.get("in") == "header" for p in params)
        if method == "post" and path != "/v1/auth/logout" and not has_key:
            problems.append(where + ": authenticated POST without Idempotency-Key")
    check("API-4", "Authenticated mutations require X-CSRF-Token; POST commands require Idempotency-Key (09 §2, §4)",
          problems)


def check_error_codes():
    text = DOCS["09-api-design.md"]
    table = dict((c, int(s)) for c, s in re.findall(r"^\| `([A-Z_]+)` \| (\d{3}) \|", section(text, "## 3. Errors"), re.M))
    api = set(enum_of("ErrorCode"))
    problems = []
    if set(table) != api:
        problems.append("09 §3 vs ErrorCode: only in 09 " + str(sorted(set(table) - api)) +
                        ", only in API " + str(sorted(api - set(table))))
    mentions = 0
    for name, raw in DOCS.items():
        for status, code in re.findall(r"`(\d{3}) ([A-Z][A-Z_]+)`", raw):
            mentions += 1
            if code in BLUEPRINT_ONLY_CODES:
                continue
            if code not in table:
                problems.append(name + ": unknown error code " + status + " " + code)
            elif table[code] != int(status):
                problems.append(name + ": " + code + " used with " + status + ", table says " + str(table[code]))
    check("API-3", "Error codes: 09 §3 equals openapi.yaml; every '`NNN CODE`' mention matches", problems, (),
          {"codes": len(table), "mentions": mentions, "blueprintOnlyAllowed": sorted(BLUEPRINT_ONLY_CODES)})


# ================================================================ coverage
def expand_ids(text, prefix):
    found = set(re.findall(r"\b" + prefix + r"-(\d\d)\b", text))
    for a, b in re.findall(r"\b" + prefix + r"-(\d\d)\s*[–-]\s*" + prefix + r"-(\d\d)\b", text):
        found.update("%02d" % i for i in range(int(a), int(b) + 1))
    return found


def check_coverage(transition_ids):
    problems = []
    inv = re.findall(r"^\| (INV-\d\d) \|", DOCS["03-domain-model.md"], re.M)
    if inv != ["INV-%02d" % i for i in range(1, len(inv) + 1)]:
        problems.append("03 invariants not contiguous")
    tm = DOCS["11-test-matrix.md"]
    inv_rows = set(re.findall(r"^\| (INV-\d\d) ", section(tm, "## 2."), re.M))
    for i in inv:
        if i not in inv_rows:
            problems.append(i + " has no row in 11 §2")
    covered = expand_ids(tm, "E")
    for t in transition_ids or []:
        if t[2:] not in covered:
            problems.append(t + " not covered in 11")
    t01 = set(int(n) for n in re.findall(r"^\| T01-(\d+) \|", tm, re.M))
    if t01 != set(range(1, 13)):
        problems.append("11 §3.1 does not list T01-1..T01-12 exactly: " + str(sorted(t01)))
    check("TST-1", "Every invariant, transition and T01 scenario has a test in 11", problems, (),
          {"invariants": len(inv), "transitions": len(transition_ids or []), "t01Scenarios": len(t01)})


def check_06_lists():
    text = DOCS["06-diagnosis-evidence-mastery.md"]
    problems = []
    codes = set()
    for sub in ("### 5.1", "### 5.2"):
        for line in section(text, sub, r"^#{2,3} ").split("\n"):
            if line.startswith("| ") and not line.startswith("| #") and not line.startswith("|---"):
                cells = [c.strip() for c in line.strip().strip("|").split("|")]
                codes.update(re.findall(r"`([A-Z_]+)`", cells[-1]))
    api = set(enum_of("EligibilityReason"))
    if codes != api:
        problems.append("06 §5 reason codes vs EligibilityReason: only in 06 " + str(sorted(codes - api)) +
                        ", only in API " + str(sorted(api - codes)))
    line = next((l for l in text.split("\n") if "closed list" in l), "")
    unc = set(re.findall(r"`([A-Z_]+)`", line))
    if unc != set(enum_of("UncertaintyReason")):
        problems.append("06 §2.5 uncertainty reasons differ from UncertaintyReason")
    classes = set(re.findall(r"^\| `([A-Z_]+)` \|", section(text, "## 1."), re.M))
    if classes != set(enum_of("Classification")):
        problems.append("06 §1 classifications differ from Classification")
    check("DOC-1", "06 eligibility, uncertainty and classification codes equal openapi.yaml", problems)


# =================================================================== links
def gh_slug(heading):
    h = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", heading.strip()).lower()
    return "".join(ch for ch in h if ch.isalnum() or ch in " -_").replace(" ", "-")


def anchors(text):
    seen, out = {}, set()
    for line in strip_code_fences(text).split("\n"):
        m = re.match(r"^(#{1,6}) (.*)$", line)
        if m:
            base = gh_slug(m.group(2))
            n = seen.get(base, 0)
            out.add(base if n == 0 else base + "-" + str(n))
            seen[base] = n + 1
    return out


def check_links():
    problems, count = [], 0
    cache = {}
    for name, raw in DOCS.items():
        text = strip_code_fences(raw)
        for target in re.findall(r"\[[^\]]+\]\(([^)\s]+)\)", text):
            if re.match(r"^[a-z]+:", target):
                continue
            count += 1
            file_part, _, anchor = target.partition("#")
            path = os.path.normpath(os.path.join(HERE, file_part)) if file_part else os.path.join(HERE, name)
            if not os.path.exists(path):
                problems.append(name + ": missing file " + target)
                continue
            if anchor and path.endswith(".md"):
                if path not in cache:
                    with io.open(path, encoding="utf-8") as fh:
                        cache[path] = anchors(fh.read())
                if anchor not in cache[path]:
                    problems.append(name + ": missing anchor " + target)
    check("DOC-2", "Relative Markdown links and #anchors resolve (GitHub slug rules)", problems, (), {"links": count})


# ================================================================ self-test
OAS = "docs/backend-architecture/openapi.yaml"
ERD = "docs/backend-architecture/04-postgresql-erd.md"
MUTATIONS = [
    ("unresolved $ref", OAS, "$ref: '#/components/schemas/AttemptResult'",
     "$ref: '#/components/schemas/AttemptResultX'", {"OAS-1", "OAS-2"}),
    ("undeclared path parameter", OAS, "  /v1/attempts/{attemptId}:\n",
     "  /v1/attempts/{attemptUuid}:\n", {"OAS-1", "API-1"}),
    ("example violates its schema", OAS, "kind: INITIAL\n          ordinal: 1",
     "kind: INITIALS\n          ordinal: 1", {"OAS-2"}),
    ("example span quote wrong", OAS, "                  end: 6\n", "                  end: 7\n", {"OAS-2"}),
    ("ERD relationship removed", ERD, '  learner ||--o{ mastery_state : "projects"\n', "", {"DB-1"}),
    ("table count text wrong", ERD, "cover the 44 tables", "cover the 43 tables", {"DB-1"}),
    ("DDL enum drift", ERD, "'PENDING_CONSENT','ACTIVE','SUSPENDED','DELETION_PENDING'",
     "'PENDING_CONSENT','ACTIVE','SUSPENDED','DELETION_PENDING','BLOCKED'", {"DB-2"}),
    ("unknown state in diagram", "docs/backend-architecture/05-learning-state-machine.md", "  COMPLETED --> [*]\n",
     "  COMPLETED --> [*]\n  QUESTION --> PAUSED: x\n", {"SM-1"}),
    ("catalogue row removed", "docs/backend-architecture/09-api-design.md",
     "| `GET` | `/v1/me/stats` | learner | XP, level, streak, today's missions |\n", "", {"API-1"}),
    ("unknown endpoint mentioned", "docs/backend-architecture/12-implementation-roadmap.md", "## 4. Assumptions",
     "## 4. Assumptions\n\nSee `GET /v1/me/badges`.\n", {"API-2"}),
    ("error status drift", "docs/backend-architecture/09-api-design.md", "| `ALREADY_IMPORTED` | 409 |",
     "| `ALREADY_IMPORTED` | 422 |", {"API-3"}),
    ("CSRF and idempotency key dropped", OAS,
     "          csrfToken: []\n      parameters:\n        - $ref: '#/components/parameters/DiagnosisRunId'\n"
     "        - $ref: '#/components/parameters/IdempotencyKey'\n",
     "      parameters:\n        - $ref: '#/components/parameters/DiagnosisRunId'\n", {"API-4"}),
    ("T01 scenario row lost", "docs/backend-architecture/11-test-matrix.md", "| T01-12 |", "| T01-13 |", {"TST-1"}),
    ("eligibility code drift", "docs/backend-architecture/06-diagnosis-evidence-mastery.md", "| `FAMILY_NOT_FRESH` |",
     "| `FAMILY_SEEN` |", {"DOC-1"}),
    ("broken anchor", "docs/backend-architecture/05-learning-state-machine.md",
     "(04-postgresql-erd.md#7-concurrency-and-idempotency)", "(04-postgresql-erd.md#7-concurrency)", {"DOC-2"}),
    ("frontend enum drift", "src/services/learningBackend.ts", "'insufficient_evidence' | 'failed';",
     "'insufficient_evidence' | 'failed' | 'cancelled';", {"FE-1"}),
]
FRONTEND_FILES = ("src/services/learningBackend.ts", "src/services/tutor.ts", "src/composables/useLearnerProgress.ts")


def self_test():
    problems, warnings, passed = [], [], 0
    cases = [("baseline", None, None, None, set())] + MUTATIONS
    for name, rel, old, new, expected in cases:
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(HERE, os.path.join(tmp, "docs", "backend-architecture"))
            for f in FRONTEND_FILES:
                if os.path.exists(os.path.join(REPO, f)):
                    os.makedirs(os.path.dirname(os.path.join(tmp, f)), exist_ok=True)
                    shutil.copy(os.path.join(REPO, f), os.path.join(tmp, f))
            if rel:
                target = os.path.join(tmp, rel)
                if not os.path.exists(target):
                    warnings.append(name + ": file missing, case skipped")
                    continue
                with io.open(target, encoding="utf-8") as fh:
                    text = fh.read()
                if old not in text:
                    warnings.append(name + ": mutation target not found (update MUTATIONS)")
                    continue
                with io.open(target, "w", encoding="utf-8", newline="\n") as fh:
                    fh.write(text.replace(old, new, 1))
            proc = subprocess.run([sys.executable, os.path.join(tmp, "docs", "backend-architecture", "validate-spec.py")],
                                  capture_output=True, text=True, encoding="utf-8", errors="replace")
            failed = {line.split()[1] for line in proc.stdout.splitlines() if line.startswith("[FAIL]")}
            if "Traceback" in proc.stderr:
                failed.add("CRASH")
            if failed == expected:
                passed += 1
            else:
                problems.append(name + ": failed " + str(sorted(failed)) + ", expected " + str(sorted(expected)))
    check("SELF-1", "Self-test: each check fails on its targeted mutation, and only then", problems, warnings,
          {"cases": len(cases), "behavedAsExpected": passed})


# ===================================================================== main
def run_consumer_suite():
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        check("FE-2", "npm run test:backend (consumer contract suite)", [], ["npm not found; not run"])
        return
    proc = subprocess.run([npm, "run", "test:backend"], cwd=REPO, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
    tail = [l for l in (proc.stdout + proc.stderr).strip().split("\n") if l.strip()][-3:]
    check("FE-2", "npm run test:backend (consumer contract suite, unchanged frontend)",
          [] if proc.returncode == 0 else ["exit code " + str(proc.returncode)], (), {"lastLines": tail})


def safe(cid, fn, *args):
    """One broken input must not hide the other checks."""
    try:
        return fn(*args)
    except Exception as exc:  # noqa: BLE001 - reported as a failed check
        check(cid, "crashed: " + fn.__name__, [type(exc).__name__ + ": " + str(exc)])
        return None


def main():
    op_count = safe("OAS-1", check_openapi_structure)
    safe("OAS-2", check_examples)
    safe("DB-1", check_erd)
    safe("DB-2", check_enums)
    transition_ids = safe("SM-1", check_state_machine)
    safe("API-1", check_catalogue, op_count)
    safe("API-2", check_mentions)
    safe("FE-1", check_frontend_contract)
    safe("API-3", check_error_codes)
    safe("API-4", check_mutation_rules)
    safe("TST-1", check_coverage, transition_ids)
    safe("DOC-1", check_06_lists)
    safe("DOC-2", check_links)
    if "--run-consumer-suite" in sys.argv:
        safe("FE-2", run_consumer_suite)
    if "--self-test" in sys.argv:
        safe("SELF-1", self_test)

    summary = {s: sum(1 for r in results if r["status"] == s) for s in ("pass", "warn", "fail")}
    for r in results:
        print("[" + r["status"].upper() + "] " + r["id"] + " " + r["title"])
        for p in r.get("problems", []):
            print("    x " + p)
        for w in r.get("warnings", []):
            print("    ! " + w)
    print("summary:", summary)

    if "--write" in sys.argv:
        out = {
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "generator": "docs/backend-architecture/validate-spec.py (offline; PyYAML " + yaml.__version__ + ")",
            "scope": "Specification documents 01-12 and openapi.yaml. No service, database or migration exists.",
            "summary": summary,
            "checks": results,
            "notPerformed": [
                {"item": "Official OpenAPI 3.1 validation",
                 "reason": "No OpenAPI validator is available offline here, and installing one needs approval.",
                 "howToRun": "uvx openapi-spec-validator docs/backend-architecture/openapi.yaml  (or: npx @redocly/cli lint docs/backend-architecture/openapi.yaml); pin the tool version in CI"},
                {"item": "Executing the DDL against PostgreSQL 16+",
                 "reason": "Specification only; no database in this environment.",
                 "howToRun": "Extract the ```sql blocks of 04 in order into one file and run psql -v ON_ERROR_STOP=1 -f on an empty PostgreSQL 16 database (an acceptance gate in 11/12)."},
                {"item": "Rendering the Mermaid diagrams",
                 "reason": "No renderer used; diagrams were checked only by the parsers above.",
                 "howToRun": "Open the files on GitHub or run @mermaid-js/mermaid-cli."},
                {"item": "Legal review",
                 "reason": "Engineering reading of the sources in 08 §7 only; not legal advice.",
                 "howToRun": "Indonesian counsel reviews 08 and the open decisions in 12 §3."},
            ],
        }
        with io.open(os.path.join(HERE, "verification.json"), "w", encoding="utf-8", newline="\n") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print("wrote verification.json")
    return 1 if summary["fail"] else 0


if __name__ == "__main__":
    sys.exit(main())
