.PHONY: quality bump-version

quality:
	./scripts/quality.sh

bump-version:
	@if [ -z "$(TYPE)" ]; then echo "Usage: make bump-version TYPE={feat|fix|breaking}"; exit 1; fi
	python3 scripts/bump_version.py --change-type $(TYPE)
