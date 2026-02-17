from django.test import TestCase

class NormalizationUtilsTest(TestCase):
    """Tests for text normalization utilities."""
    
    def test_normalize_text_basic(self):
        """Test basic text normalization."""
        from farm.utils import normalize_text
        
        self.assertEqual(normalize_text("  Hello World  "), "hello world")
        self.assertEqual(normalize_text("UPPERCASE"), "uppercase")
        self.assertEqual(normalize_text("Multiple   Spaces"), "multiple spaces")
    
    def test_normalize_text_edge_cases(self):
        """Test edge cases for text normalization."""
        from farm.utils import normalize_text
        
        self.assertIsNone(normalize_text(None))
        self.assertIsNone(normalize_text(""))
        self.assertIsNone(normalize_text("   "))
        self.assertEqual(normalize_text("abc"), "abc")
    
    def test_normalize_supplier_name_basic(self):
        """Test supplier name normalization."""
        from farm.utils import normalize_supplier_name
        
        self.assertEqual(normalize_supplier_name("ACME Seeds"), "acme seeds")
        self.assertEqual(normalize_supplier_name("  Green Inc.  "), "green")
    
    def test_normalize_supplier_name_legal_suffixes(self):
        """Test that legal suffixes are removed."""
        from farm.utils import normalize_supplier_name
        
        self.assertEqual(normalize_supplier_name("Farm GmbH"), "farm")
        self.assertEqual(normalize_supplier_name("Seeds KG"), "seeds")
        self.assertEqual(normalize_supplier_name("Company OG"), "company")
        self.assertEqual(normalize_supplier_name("Business Ltd."), "business")
        self.assertEqual(normalize_supplier_name("Corp Inc"), "corp")
        self.assertEqual(normalize_supplier_name("Trade AG"), "trade")
        self.assertEqual(normalize_supplier_name("Partners GbR"), "partners")
        self.assertEqual(normalize_supplier_name("Seeds Co. KG"), "seeds")

