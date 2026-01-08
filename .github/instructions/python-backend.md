# Python Backend Instructions

Language: Python. Environment and packages managed with PDM.

Do not suggest or introduce `pip install`, `requirements.txt`, or `setup.py`. Use PDM commands:

- `pdm init`
- `pdm add <package>`
- `pdm install`
- `pdm run <command>`

## Code Style & Typing

- Follow PEP 8.
- Every new or changed function/method must include full type hints for all parameters and the return value.
- Provide a PEP 257-compliant docstring in Sphinx/reST style using `:param` and `:return:`.

Example:

```python
def compute_yield(area_m2: float, yield_per_m2: float) -> float:
    """
    Compute the expected yield for a given area.

    :param area_m2: Area in square meters.
    :param yield_per_m2: Expected yield per square meter.
    :return: Total expected yield.
    """
    return area_m2 * yield_per_m2
```

### Classes

- Each class should have a docstring that briefly explains:
  - what the class represents,
  - how it is used,
  - important attributes (short description).

## Physical Units

- **Always use SI units internally** for all physical measurements stored in the database.
- Examples:
  - Lengths and distances: meters (m), not centimeters or feet
  - Areas: square meters (m²)
  - Volumes: cubic meters (m³) or liters (L)
  - Masses: kilograms (kg)
  - Time: seconds (s) or derived units (days for agriculture)
- **User-facing APIs** may expose values in more convenient units (e.g., centimeters for plant spacing).
- Perform unit conversion **only at system boundaries** (serializers, forms, API layer).
- **Document the unit** clearly in:
  - Model field `help_text`
  - Docstrings
  - API documentation/schema

Example:
```python
# Model field - stored in SI units (meters)
distance_within_row_m = models.FloatField(
    null=True,
    blank=True,
    help_text="Distance within row in meters (stored in SI units)"
)

# Serializer - converts to/from user-friendly units (centimeters)
distance_within_row_cm = CentimetersField(
    source='distance_within_row_m',
    help_text='Distance within row in centimeters'
)
```

## Tests & Structure

- When generating non-trivial new functions, also propose pytest-style tests.
- Tests should cover normal cases, edge cases, and error cases where sensible.
- Prefer pure functions and a clean separation of logic and I/O.
