"""OpenFarm data import utilities for TinyFarm.

This module provides functions to map OpenFarm plant data to TinyFarm Culture model
and utilities for downloading and processing OpenFarm plant data.
"""

from typing import Dict, Any, Optional, Union
import logging

logger = logging.getLogger(__name__)


class SkipPlant(Exception):
    """Exception raised when a plant should be skipped during import.
    
    Attributes:
        reason: Explanation for why the plant is being skipped
    """
    
    def __init__(self, reason: str):
        """Initialize SkipPlant exception.
        
        :param reason: Explanation for skipping
        """
        self.reason = reason
        super().__init__(reason)


def map_openfarm_plant_to_culture(plant_data: Dict[str, Any]) -> Dict[str, Any]:
    """Map OpenFarm plant data to TinyFarm Culture model fields.
    
    This function converts a plant entry from OpenFarm's data format to the
    field structure expected by TinyFarm's Culture model. It handles field
    name mapping, type conversion, and data validation.
    
    :param plant_data: Dictionary containing OpenFarm plant data
    :return: Dictionary of Culture model fields ready for creation/update
    :raises SkipPlant: If the plant data is invalid or should be skipped
    """
    # Validate required fields
    name = plant_data.get('name', '').strip()
    if not name:
        raise SkipPlant("Missing required 'name' field")
    
    # Extract variety/cultivar name
    variety = plant_data.get('cultivar_name', '').strip()
    
    # Map basic identifiers
    culture_data = {
        'name': name,
        'variety': variety,
        'openfarm_id': plant_data.get('_id'),
        'openfarm_slug': plant_data.get('slug'),
    }
    
    # Map scientific naming
    culture_data['binomial_name'] = plant_data.get('binomial_name')
    culture_data['taxon'] = plant_data.get('taxon')
    
    # Map common names (handle both array and string formats)
    common_names = plant_data.get('common_names')
    if common_names is not None:
        if isinstance(common_names, list):
            culture_data['common_names'] = common_names
        elif isinstance(common_names, str):
            culture_data['common_names'] = [common_names]
        else:
            # Unexpected type - log warning and set empty array as fallback
            logger.warning(
                f"Unexpected type for common_names in {name}: "
                f"{type(common_names).__name__}. Setting to empty array."
            )
            culture_data['common_names'] = []
    
    # Map description
    culture_data['description'] = plant_data.get('description', '')
    
    # Map growing requirements
    culture_data['sun_requirements'] = plant_data.get('sun_requirements')
    culture_data['sowing_method'] = plant_data.get('sowing_method')
    
    # Map dimensional data (convert to centimeters if needed)
    spread = plant_data.get('spread')
    if spread is not None:
        try:
            culture_data['spread_cm'] = int(spread)
            # Also use spread for plant_spacing_cm as a reasonable default
            culture_data['plant_spacing_cm'] = int(spread)
        except (ValueError, TypeError):
            logger.warning(f"Invalid spread value for {name}: {spread}")
    
    height = plant_data.get('height')
    if height is not None:
        try:
            culture_data['height_cm'] = int(height)
        except (ValueError, TypeError):
            logger.warning(f"Invalid height value for {name}: {height}")
    
    row_spacing = plant_data.get('row_spacing')
    if row_spacing is not None:
        try:
            culture_data['row_spacing_cm'] = int(row_spacing)
        except (ValueError, TypeError):
            logger.warning(f"Invalid row_spacing value for {name}: {row_spacing}")
    
    # Map growing degree days
    gdd = plant_data.get('growing_degree_days')
    if gdd is not None:
        try:
            culture_data['growing_degree_days'] = int(gdd)
        except (ValueError, TypeError):
            logger.warning(f"Invalid growing_degree_days value for {name}: {gdd}")
    
    # Store the complete raw OpenFarm data
    culture_data['openfarm_raw'] = plant_data
    
    return culture_data


def extract_maturity_days(plant_data: Dict[str, Any]) -> Optional[int]:
    """Extract maturity days from OpenFarm plant data.
    
    OpenFarm may store this in various fields like 'days_to_maturity',
    'time_to_harvest', or within guides/stages. This function attempts
    to extract a reasonable value.
    
    :param plant_data: Dictionary containing OpenFarm plant data
    :return: Maturity days if found, None otherwise
    """
    # Check direct fields (not typically in OpenFarm but possible in extensions)
    for field in ['days_to_maturity', 'maturity_days', 'time_to_harvest', 'days_to_harvest']:
        value = plant_data.get(field)
        if value is not None:
            try:
                return int(value)
            except (ValueError, TypeError):
                continue
    
    # Could not extract maturity days
    return None


def get_upsert_key(culture_data: Dict[str, Any]) -> Dict[str, Any]:
    """Determine the unique key for upserting a Culture record.
    
    Prefers openfarm_id if present, otherwise uses (name, variety) combination.
    
    :param culture_data: Dictionary of Culture model fields
    :return: Dictionary with key fields for lookup
    """
    if culture_data.get('openfarm_id'):
        return {'openfarm_id': culture_data['openfarm_id']}
    else:
        return {
            'name': culture_data['name'],
            'variety': culture_data.get('variety', '')
        }
