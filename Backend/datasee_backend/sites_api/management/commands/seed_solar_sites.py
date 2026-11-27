from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from sites_api.services import import_sites_from_csv


class Command(BaseCommand):
    help = 'Seed solar_sites_data.csv into the database and calculate initial suitability scores.'

    def add_arguments(self, parser):
        default_csv = Path(settings.BASE_DIR) / 'sql' / 'solar_sites_data.csv'
        parser.add_argument(
            '--csv',
            type=str,
            default=str(default_csv),
            help=f'Path to CSV dataset (default: {default_csv})',
        )

    def handle(self, *args, **options):
        csv_path = Path(options['csv'])
        if not csv_path.exists():
            raise CommandError(f'CSV file not found: {csv_path}')

        with csv_path.open('rb') as handle:
            summary = import_sites_from_csv(handle)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {summary['processed']} sites "
                f"(created: {summary['created']}, updated: {summary['updated']})."
            )
        )

