"""
One-off extractor: SALES AND INVENTORY.xlsx -> prisma/seed_data/seed.json

Maps the perfume-business Excel (matrix layout) onto the generic schema
(Category / Attribute / AttributeValue / Product / Variant / VariantAttribute)
described in CLAUDE.md section 4-5. Does NOT touch the database — Prisma
seed.ts reads the JSON this produces and writes the rows.

Decisions applied (CLAUDE.md section 6):
- Historical SALES sheet totals are NOT imported (sales log starts clean).
- Only current on-hand stock (INVENTORY sheet) is imported.
"""

import json
import re
from pathlib import Path

import openpyxl

SOURCE = Path(r"C:\Users\Reinhard Ramirez BTG\Downloads\SALES AND INVENTORY.xlsx")
OUT = Path(__file__).resolve().parent.parent / "prisma" / "seed_data" / "seed.json"

# Size column -> (label, default price in PHP). Column order matches the
# Excel header row B:H on both sheets.
SIZE_COLUMNS = [
    ("50 ML", 300),
    ("30 ML", 200),
    ("100 ML (type A)", 500),
    ("100 ML (type B)", 450),
    ("Scraps", 200),
    ("10 ML", 100),
    ("10 ML (LP)", 80),
]

MAIN_PRODUCT_ROWS = range(2, 19)  # rows 2-18 inclusive (1-indexed incl header)

# 50 ML / 10 ML oil-concentration sub-tables: (first_product_row, size_label)
# Product rows sit directly below the "20/25/.../35" concentration header row.
OIL_SUBTABLES = [
    (23, "50 ML"),  # header row 22, products rows 23-27
    (33, "10 ML"),  # header row 32, products rows 33-37
]
OIL_PRODUCT_COUNT = 5
# (spreadsheet column, concentration %) - column C is a spacer, no data
CONCENTRATION_COLUMNS = [(2, 20), (3, 25), (5, 30), (6, 35)]


def clean_name(name):
    return re.sub(r"\s+", " ", str(name)).strip()


def main():
    wb = openpyxl.load_workbook(SOURCE, data_only=True)
    inv = wb["INVENTORY"]

    categories = [
        {"name": "Main Decants"},
        {"name": "Oil Concentration"},
    ]

    size_attribute_values = [{"value": label, "sortOrder": i} for i, (label, _) in enumerate(SIZE_COLUMNS)]
    concentration_attribute_values = [
        {"value": str(c), "sortOrder": i} for i, (_, c) in enumerate(CONCENTRATION_COLUMNS)
    ]

    attributes = [
        {"name": "Size", "unit": "ML", "values": size_attribute_values},
        {"name": "Concentration", "unit": "%", "values": concentration_attribute_values},
    ]

    products = []  # {name, category, variants: [{size, concentration, stockQty, price}]}

    # --- Main table: rows 2-18, columns B-H = 7 sizes ---
    for row_idx in MAIN_PRODUCT_ROWS:
        row = [inv.cell(row=row_idx, column=c).value for c in range(1, 9)]
        name = row[0]
        if name is None or not str(name).strip():
            continue
        variants = []
        for col_offset, (size_label, default_price) in enumerate(SIZE_COLUMNS):
            qty = row[1 + col_offset]
            if qty is None or str(qty).strip() == "":
                continue
            try:
                qty_int = int(float(qty))
            except (TypeError, ValueError):
                continue
            variants.append({
                "size": size_label,
                "concentration": None,
                "stockQty": qty_int,
                "price": default_price,
            })
        if variants:
            products.append({
                "name": clean_name(name),
                "category": "Main Decants",
                "variants": variants,
            })

    # --- Oil sub-tables: 50 ML block (rows 22-26) + 10 ML block (rows 32-36) ---
    # product name -> {concentration -> stockQty}, merged across both blocks
    oil_products = {}
    for first_row, size_label in OIL_SUBTABLES:
        for i in range(OIL_PRODUCT_COUNT):
            row_idx = first_row + i
            name = inv.cell(row=row_idx, column=1).value
            if name is None or not str(name).strip():
                continue
            name = clean_name(name)
            oil_products.setdefault(name, [])
            for col, concentration in CONCENTRATION_COLUMNS:
                qty = inv.cell(row=row_idx, column=col).value
                if qty is None or str(qty).strip() == "":
                    continue
                try:
                    qty_int = int(float(qty))
                except (TypeError, ValueError):
                    continue
                oil_products[name].append({
                    "size": size_label,
                    "concentration": concentration,
                    "stockQty": qty_int,
                    "price": None,  # no explicit price for oil line in Excel; set later in app
                })

    for name, variants in oil_products.items():
        if variants:
            products.append({
                "name": name,
                "category": "Oil Concentration",
                "variants": variants,
            })

    seed = {
        "settings": [
            {"key": "currency", "value": "PHP"},
            {"key": "reinvestment_goal_min", "value": "15000"},
            {"key": "reinvestment_goal_max", "value": "20000"},
        ],
        "categories": categories,
        "attributes": attributes,
        "products": products,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(seed, indent=2), encoding="utf-8")

    main_count = sum(1 for p in products if p["category"] == "Main Decants")
    oil_count = sum(1 for p in products if p["category"] == "Oil Concentration")
    variant_count = sum(len(p["variants"]) for p in products)
    print(f"Wrote {OUT}")
    print(f"Main products: {main_count}, Oil products: {oil_count}, Variants: {variant_count}")


if __name__ == "__main__":
    main()
