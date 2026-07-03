"""
This app deliberately defines no models of its own yet.

The data this app serves (`PublicCulture`) still lives in `farm.models`,
because moving a model to a different Django app changes its migration
state and (without careful `SeparateDatabaseAndState` migrations) its
`app_label`-derived db_table — a real risk to existing data that isn't
justified until the crop library is actually extracted into its own
service. See docs/crop-library-architecture.md for the full reasoning and
the migration path to take when that extraction happens.

Until then, `crops.services`/`crops.serializers`/`crops.views` import
`PublicCulture` directly from `farm.models` — the one sanctioned
dependency this app has on `farm`, and the thing to remove first in a
future extraction.
"""
