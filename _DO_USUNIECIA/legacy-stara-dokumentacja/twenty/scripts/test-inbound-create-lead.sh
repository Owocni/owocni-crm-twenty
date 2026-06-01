#!/bin/bash
# test-inbound-create-lead.sh
# Symuluje call adaptera crm:twenty_create_deal z Sortowni Stape
# Tworzy: Person → Opportunity → NoteTarget (linkuje Note do Opp + Person)
#
# Użycie: ./test-inbound-create-lead.sh

set -euo pipefail

API_KEY="eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImM0MDYwZTJkLTFmMzEtNDUzYi1iYWZiLTA0YjgyNDAwMGYzNSJ9.eyJzdWIiOiIyNTM0YjE5My01NTIzLTRlOWQtYjQ1Yy1hZTczODE4ZGM3MjQiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiMjUzNGIxOTMtNTUyMy00ZTlkLWI0NWMtYWU3MzgxOGRjNzI0IiwiaWF0IjoxNzc5NjkzOTE2LCJleHAiOjQ5MzMyOTM5MTUsImp0aSI6IjE4NGFhNmUzLTBhMjAtNDJhYi1hNTIzLTcyYTc2NDQ0NGFjZCJ9.PBR0tXM__f9DulQJkpK74TjrETSHOo23zDcw_xfP-IBLC_W0OgHpU-IJUgXteOagXrZ4-ikBMZLE8yDJd95YvA"
API_URL="https://api.twenty.com/graphql"

# --- Symulowany payload generate_lead z Sortowni ---
ID_OID="01JXK8TESTINBOUND00000001"
BIZ_NAME="Anna Testowa"
BIZ_EMAIL="anna.testowa@example.com"
BIZ_PHONE="+48500100200"
BIZ_PRODUCT="WEB"
BIZ_SOURCE="GOOGLE_ADS"
BIZ_MESSAGE="Cześć, potrzebuję strony internetowej dla mojej firmy cateringowej. Zależy mi na nowoczesnym designie i systemie rezerwacji online."

echo "=== Inbound Adapter: create_lead ==="
echo "id_oid: $ID_OID"
echo "biz_name: $BIZ_NAME"
echo "biz_email: $BIZ_EMAIL"
echo ""

# --- Step 1: Create Person ---
FIRST_NAME=$(echo "$BIZ_NAME" | cut -d' ' -f1)
LAST_NAME=$(echo "$BIZ_NAME" | cut -d' ' -f2-)

echo "Step 1: Creating Person..."
PERSON_RESULT=$(curl -s "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { createPerson(data: { name: { firstName: \\\"$FIRST_NAME\\\", lastName: \\\"$LAST_NAME\\\" }, emails: { primaryEmail: \\\"$BIZ_EMAIL\\\" }, phones: { primaryPhoneNumber: \\\"$BIZ_PHONE\\\" } }) { id name { firstName lastName } emails { primaryEmail } } }\"}")

PERSON_ID=$(echo "$PERSON_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['createPerson']['id'])" 2>/dev/null)

if [ -z "$PERSON_ID" ]; then
  echo "  ERROR creating Person:"
  echo "$PERSON_RESULT" | python3 -m json.tool 2>/dev/null || echo "$PERSON_RESULT"
  exit 1
fi
echo "  Created Person: $PERSON_ID ($FIRST_NAME $LAST_NAME)"

# --- Step 2: Create Opportunity ---
echo "Step 2: Creating Opportunity..."
OPP_RESULT=$(curl -s "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { createOpportunity(data: { name: \\\"Strona Internetowa — Firma Cateringowa\\\", stage: NEW, idOid: \\\"$ID_OID\\\", bizProduct: \\\"$BIZ_PRODUCT\\\", bizSource: \\\"$BIZ_SOURCE\\\", pointOfContactId: \\\"$PERSON_ID\\\" }) { id name stage idOid bizProduct } }\"}")

OPP_ID=$(echo "$OPP_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['createOpportunity']['id'])" 2>/dev/null)

if [ -z "$OPP_ID" ]; then
  echo "  ERROR creating Opportunity:"
  echo "$OPP_RESULT" | python3 -m json.tool 2>/dev/null || echo "$OPP_RESULT"
  exit 1
fi
echo "  Created Opportunity: $OPP_ID (stage=NEW, bizProduct=$BIZ_PRODUCT)"

# --- Step 3: Create Note with biz_message_content ---
echo "Step 3: Creating Note..."
ESCAPED_MSG=$(echo "$BIZ_MESSAGE" | sed 's/"/\\"/g')
NOTE_RESULT=$(curl -s "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { createNote(data: { title: \\\"Pierwsza wiadomość — Strona internetowa\\\", bodyV2: { markdown: \\\"$ESCAPED_MSG\\\" } }) { id title } }\"}")

NOTE_ID=$(echo "$NOTE_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['createNote']['id'])" 2>/dev/null)

if [ -z "$NOTE_ID" ]; then
  echo "  ERROR creating Note:"
  echo "$NOTE_RESULT" | python3 -m json.tool 2>/dev/null || echo "$NOTE_RESULT"
  exit 1
fi
echo "  Created Note: $NOTE_ID"

# --- Step 4: Link Note to Opportunity + Person via NoteTargets ---
echo "Step 4: Linking Note to Opportunity + Person..."
LINK_OPP=$(curl -s "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { createNoteTarget(data: { noteId: \\\"$NOTE_ID\\\", targetOpportunityId: \\\"$OPP_ID\\\" }) { id } }\"}")

LINK_PERSON=$(curl -s "$API_URL" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { createNoteTarget(data: { noteId: \\\"$NOTE_ID\\\", targetPersonId: \\\"$PERSON_ID\\\" }) { id } }\"}")

LINK_OPP_ID=$(echo "$LINK_OPP" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['createNoteTarget']['id'])" 2>/dev/null)
LINK_PERSON_ID=$(echo "$LINK_PERSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['createNoteTarget']['id'])" 2>/dev/null)

echo "  Linked Note→Opportunity: $LINK_OPP_ID"
echo "  Linked Note→Person: $LINK_PERSON_ID"

# --- Summary ---
echo ""
echo "=== SUCCESS ==="
echo "Person ID:      $PERSON_ID"
echo "Opportunity ID: $OPP_ID"
echo "Note ID:        $NOTE_ID"
echo "id_oid:         $ID_OID"
echo ""
echo "Sprawdz w Twenty UI:"
echo "  https://zany-maroon-panther.twenty.com/objects/opportunities/$OPP_ID"
