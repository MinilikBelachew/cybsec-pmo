import io
import unicodedata
import openpyxl

path = r"D:\cybsec-pmo\UAT_Test_Case_Register_v2_phase3_updated.xlsx"
out = io.open(r"D:\cybsec-pmo\scripts\_uat_phase3.md", "w", encoding="ascii", errors="replace")

wb = openpyxl.load_workbook(path, data_only=True)
ws = wb["Test Cases"]
rows = list(ws.iter_rows(values_only=True))
header = [str(h) if h is not None else "" for h in rows[0]]


def clean(s):
    s = str(s)
    s = (s.replace("\u2192", "->").replace("\u25b6", ">").replace("\u2013", "-")
          .replace("\u2014", "-").replace("\u2018", "'").replace("\u2019", "'")
          .replace("\u201c", '"').replace("\u201d", '"').replace("\u2026", "...")
          .replace("\u2022", "*").replace("\u00a0", " "))
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")


count = 0
for row in rows[1:]:
    phase = clean(row[1]) if row[1] is not None else ""
    if not phase.strip().startswith("3"):
        continue
    count += 1
    out.write("\n" + "=" * 80 + "\n")
    for h, c in zip(header, row):
        if h == "" or c is None or str(c).strip() == "":
            continue
        if h in ("Tester", "Test Date", "Result", "Evidence Link / File", "Defect ID",
                 "Retest Result", "Cybsec Sign-off"):
            continue
        out.write("%s: %s\n" % (clean(h), clean(c)))
out.write("\nTOTAL PHASE 3 CASES: %d\n" % count)
out.close()
print("count", count)
