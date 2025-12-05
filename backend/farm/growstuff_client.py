"""
Growstuff API client for fetching crop data.

This module provides a client for interacting with the Growstuff API
to fetch crop/culture information. It includes rate limiting and error
handling to comply with the API usage policy.

The Growstuff API is a Rails-based API that requires the .json extension
on endpoints to return JSON responses. This client automatically appends
.json to all endpoint requests.

Growstuff API Documentation: https://www.growstuff.org/api-docs/index.html
Data License: CC-BY-SA (Creative Commons Attribution-ShareAlike)

API Usage Policy: "Don't overload our servers. You agree to limit your 
access to the API in such a way as to prevent excessive load on the Service."
"""

import logging
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

import requests


logger = logging.getLogger(__name__)


class GrowstuffAPIError(Exception):
    """Base exception for Growstuff API errors."""
    pass


class GrowstuffRateLimitError(GrowstuffAPIError):
    """Raised when API rate limit is exceeded."""
    pass


class GrowstuffClient:
    """
    Client for interacting with the Growstuff API.
    
    This client handles fetching crop data from the Growstuff API
    with built-in rate limiting and error handling. It respects
    the Growstuff API usage policy and data licensing requirements.
    
    Attributes:
        base_url: Base URL for the Growstuff API (default: https://www.growstuff.org/api/v1)
        timeout: Request timeout in seconds (default: 10)
        rate_limit_delay: Minimum seconds between API requests (default: 1.0)
        last_request_time: Timestamp of the last API request
        session: Requests session for connection pooling
    """
    
    def __init__(
        self, 
        base_url: str = "https://www.growstuff.org/api/v1",
        timeout: int = 10,
        rate_limit_delay: float = 1.0
    ) -> None:
        """
        Initialize the Growstuff API client.
        
        :param base_url: Base URL for the Growstuff API
        :param timeout: Request timeout in seconds
        :param rate_limit_delay: Minimum seconds between API requests
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self.rate_limit_delay = rate_limit_delay
        self.last_request_time: Optional[float] = None
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'OpenFarmPlanner/1.0 (Growstuff API Integration)',
            'Accept': 'application/json, text/json, */*',
        })
    
    def _apply_rate_limit(self) -> None:
        """
        Apply rate limiting between API requests.
        
        Ensures that the minimum delay between requests is respected
        to comply with API usage policies.
        """
        if self.last_request_time is not None:
            elapsed = time.time() - self.last_request_time
            if elapsed < self.rate_limit_delay:
                sleep_time = self.rate_limit_delay - elapsed
                logger.debug(f"Rate limiting: sleeping for {sleep_time:.2f} seconds")
                time.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def _make_request(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Make an HTTP GET request to the Growstuff API.
        
        :param endpoint: API endpoint path (e.g., '/crops')
        :param params: Optional query parameters
        :return: JSON response as a dictionary
        :raises GrowstuffAPIError: If the request fails
        :raises GrowstuffRateLimitError: If rate limit is exceeded
        """
        self._apply_rate_limit()
        
        # Rails APIs typically require .json extension for JSON responses
        if not endpoint.endswith('.json'):
            endpoint = f"{endpoint}.json"
        
        url = f"{self.base_url}{endpoint}"
        
        try:
            logger.debug(f"Making request to {url} with params {params}")
            response = self.session.get(url, params=params, timeout=self.timeout)
            
            if response.status_code == 429:
                raise GrowstuffRateLimitError("API rate limit exceeded")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.Timeout:
            raise GrowstuffAPIError(f"Request to {url} timed out")
        except requests.exceptions.RequestException as e:
            raise GrowstuffAPIError(f"Request to {url} failed: {str(e)}")
    
    def get_crops(self, page: int = 1, per_page: int = 100) -> Dict[str, Any]:
        """
        Fetch a page of crops from the Growstuff API.
        
        :param page: Page number (1-indexed)
        :param per_page: Number of crops per page (max 100)
        :return: Dictionary containing crop data and pagination info
        :raises GrowstuffAPIError: If the request fails
        """
        params = {
            'page': page,
            'per_page': min(per_page, 100)  # API may have max limit
        }
        
        logger.info(f"Fetching crops page {page} with {per_page} items per page")
        return self._make_request('/crops', params)
    
    def get_all_crops(self, per_page: int = 100) -> List[Dict[str, Any]]:
        """
        Fetch all crops from the Growstuff API across all pages.
        
        This method handles pagination automatically and returns all
        available crops. Use with caution for large datasets.
        
        :param per_page: Number of crops per page (max 100)
        :return: List of all crop dictionaries
        :raises GrowstuffAPIError: If any request fails
        """
        all_crops: List[Dict[str, Any]] = []
        page = 1
        
        logger.info("Fetching all crops from Growstuff API")
        
        while True:
            try:
                response = self.get_crops(page=page, per_page=per_page)
                
                # Handle different possible response structures
                if isinstance(response, dict):
                    crops = response.get('data', response.get('crops', []))
                    
                    if not crops:
                        break
                    
                    all_crops.extend(crops)
                    
                    # Check if there are more pages
                    # Common pagination patterns:
                    # - 'meta' with 'next_page' or 'total_pages'
                    # - 'pagination' with 'next' or 'has_more'
                    meta = response.get('meta', {})
                    pagination = response.get('pagination', {})
                    
                    if meta.get('next_page') is None and not pagination.get('has_more', False):
                        # No more pages
                        if len(crops) < per_page:
                            # Also check if we got fewer items than requested
                            break
                    
                    page += 1
                    
                    # Safety limit to prevent infinite loops
                    if page > 1000:
                        logger.warning("Reached safety limit of 1000 pages")
                        break
                else:
                    # If response is directly a list
                    all_crops.extend(response)
                    break
                    
            except GrowstuffAPIError as e:
                logger.error(f"Error fetching page {page}: {str(e)}")
                break
        
        logger.info(f"Fetched {len(all_crops)} total crops")
        return all_crops
    
    def get_crop_by_id(self, crop_id: int) -> Dict[str, Any]:
        """
        Fetch a specific crop by its Growstuff ID.
        
        :param crop_id: The Growstuff crop ID
        :return: Dictionary containing crop data
        :raises GrowstuffAPIError: If the request fails
        """
        logger.info(f"Fetching crop with ID {crop_id}")
        return self._make_request(f'/crops/{crop_id}')
    
    def close(self) -> None:
        """Close the HTTP session."""
        self.session.close()
    
    def __enter__(self) -> 'GrowstuffClient':
        """Context manager entry."""
        return self
    
    def __exit__(self, *args: Any) -> None:
        """Context manager exit."""
        self.close()
