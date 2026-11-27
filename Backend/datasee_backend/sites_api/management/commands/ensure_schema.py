from pathlib import Path
import re

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Ensure MySQL schema tables and view from sql/database_schema.sql exist.'

    def handle(self, *args, **options):
        existing = set(connection.introspection.table_names())
        if 'sites' in existing and 'analysis_parameters' in existing and 'analysis_results' in existing:
            self.stdout.write('Domain tables already exist; skipping schema bootstrap.')
            return

        schema_path = Path(settings.BASE_DIR) / 'sql' / 'database_schema.sql'
        raw_sql = schema_path.read_text(encoding='utf-8')

        # Strip database creation/selection and stored-procedure DELIMITER blocks;
        # scoring runs in Python SuitabilityCalculator across all environments.
        ddl_part = raw_sql.split('DELIMITER //')[0]
        ddl_part = re.sub(r'CREATE\s+DATABASE[^;]*;', '', ddl_part, flags=re.IGNORECASE)
        ddl_part = re.sub(r'USE\s+\w+\s*;', '', ddl_part, flags=re.IGNORECASE)

        statements = [stmt.strip() for stmt in ddl_part.split(';') if stmt.strip()]
        with connection.cursor() as cursor:
            for stmt in statements:
                cursor.execute(stmt)

        self.stdout.write(self.style.SUCCESS('Initialized solar site analyzer MySQL schema.'))
