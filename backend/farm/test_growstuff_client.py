"""
Tests for the Growstuff API client.

This module tests the GrowstuffClient class including rate limiting,
error handling, and API response parsing.
"""

from unittest.mock import Mock, patch, MagicMock
from django.test import TestCase
import time

from farm.growstuff_client import (
    GrowstuffClient,
    GrowstuffAPIError,
    GrowstuffRateLimitError
)


class GrowstuffClientTest(TestCase):
    """Test cases for the GrowstuffClient class."""
    
    def setUp(self) -> None:
        """Set up test fixtures."""
        self.client = GrowstuffClient(
            base_url='https://test.growstuff.org/api/v1',
            rate_limit_delay=0.1  # Faster for testing
        )
    
    def tearDown(self) -> None:
        """Clean up after tests."""
        self.client.close()
    
    def test_client_initialization(self) -> None:
        """Test that client is initialized correctly."""
        self.assertEqual(self.client.base_url, 'https://test.growstuff.org/api/v1')
        self.assertEqual(self.client.timeout, 10)
        self.assertEqual(self.client.rate_limit_delay, 0.1)
        self.assertIsNone(self.client.last_request_time)
    
    def test_rate_limiting(self) -> None:
        """Test that rate limiting is applied correctly."""
        # First request should not delay
        start_time = time.time()
        self.client._apply_rate_limit()
        first_duration = time.time() - start_time
        self.assertLess(first_duration, 0.05)  # Should be nearly instant
        
        # Second request should delay
        start_time = time.time()
        self.client._apply_rate_limit()
        second_duration = time.time() - start_time
        self.assertGreaterEqual(second_duration, 0.09)  # Should delay ~0.1s
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_successful_request(self, mock_get: Mock) -> None:
        """Test successful API request."""
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': [{'id': 1, 'name': 'Tomato'}]}
        mock_get.return_value = mock_response
        
        result = self.client._make_request('/crops')
        
        self.assertEqual(result, {'data': [{'id': 1, 'name': 'Tomato'}]})
        mock_get.assert_called_once()
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_rate_limit_error(self, mock_get: Mock) -> None:
        """Test handling of 429 rate limit response."""
        mock_response = Mock()
        mock_response.status_code = 429
        mock_get.return_value = mock_response
        
        with self.assertRaises(GrowstuffRateLimitError):
            self.client._make_request('/crops')
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_timeout_error(self, mock_get: Mock) -> None:
        """Test handling of request timeout."""
        import requests
        mock_get.side_effect = requests.exceptions.Timeout()
        
        with self.assertRaises(GrowstuffAPIError) as context:
            self.client._make_request('/crops')
        
        self.assertIn('timed out', str(context.exception))
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_request_exception(self, mock_get: Mock) -> None:
        """Test handling of general request exceptions."""
        import requests
        mock_get.side_effect = requests.exceptions.RequestException('Connection error')
        
        with self.assertRaises(GrowstuffAPIError) as context:
            self.client._make_request('/crops')
        
        self.assertIn('failed', str(context.exception))
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_get_crops(self, mock_get: Mock) -> None:
        """Test fetching a page of crops."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': [
                {'id': 1, 'name': 'Tomato'},
                {'id': 2, 'name': 'Lettuce'}
            ]
        }
        mock_get.return_value = mock_response
        
        result = self.client.get_crops(page=1, per_page=50)
        
        self.assertEqual(len(result['data']), 2)
        mock_get.assert_called_once()
        
        # Check that correct params were passed
        call_args = mock_get.call_args
        self.assertEqual(call_args[1]['params']['page'], 1)
        self.assertEqual(call_args[1]['params']['per_page'], 50)
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_get_all_crops_single_page(self, mock_get: Mock) -> None:
        """Test fetching all crops when there's only one page."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': [
                {'id': 1, 'name': 'Tomato'},
                {'id': 2, 'name': 'Lettuce'}
            ],
            'meta': {
                'next_page': None
            }
        }
        mock_get.return_value = mock_response
        
        result = self.client.get_all_crops(per_page=100)
        
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['name'], 'Tomato')
        mock_get.assert_called_once()
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_get_all_crops_multiple_pages(self, mock_get: Mock) -> None:
        """Test fetching all crops across multiple pages."""
        # Mock two pages of responses
        response_page1 = Mock()
        response_page1.status_code = 200
        response_page1.json.return_value = {
            'data': [{'id': i, 'name': f'Crop {i}'} for i in range(1, 4)],
            'meta': {'next_page': 2}
        }
        
        response_page2 = Mock()
        response_page2.status_code = 200
        response_page2.json.return_value = {
            'data': [{'id': i, 'name': f'Crop {i}'} for i in range(4, 6)],
            'meta': {'next_page': None}
        }
        
        mock_get.side_effect = [response_page1, response_page2]
        
        result = self.client.get_all_crops(per_page=3)
        
        self.assertEqual(len(result), 5)
        self.assertEqual(mock_get.call_count, 2)
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_get_crop_by_id(self, mock_get: Mock) -> None:
        """Test fetching a specific crop by ID."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'id': 123,
            'name': 'Tomato',
            'slug': 'tomato'
        }
        mock_get.return_value = mock_response
        
        result = self.client.get_crop_by_id(123)
        
        self.assertEqual(result['id'], 123)
        self.assertEqual(result['name'], 'Tomato')
        
        # Verify correct endpoint was called
        call_args = mock_get.call_args
        self.assertIn('/crops/123', call_args[0][0])
    
    def test_context_manager(self) -> None:
        """Test using client as context manager."""
        with GrowstuffClient() as client:
            self.assertIsNotNone(client)
            self.assertIsNotNone(client.session)
        
        # Session should be closed after exiting context
        # Note: We can't directly test if session is closed, but we can verify no exceptions
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_get_all_crops_with_empty_response(self, mock_get: Mock) -> None:
        """Test handling of empty response from API."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': []}
        mock_get.return_value = mock_response
        
        result = self.client.get_all_crops()
        
        self.assertEqual(len(result), 0)
        mock_get.assert_called_once()
    
    @patch('farm.growstuff_client.requests.Session.get')
    def test_max_per_page_limit(self, mock_get: Mock) -> None:
        """Test that per_page is limited to max value."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'data': []}
        mock_get.return_value = mock_response
        
        self.client.get_crops(page=1, per_page=200)
        
        # Should be capped at 100
        call_args = mock_get.call_args
        self.assertEqual(call_args[1]['params']['per_page'], 100)
