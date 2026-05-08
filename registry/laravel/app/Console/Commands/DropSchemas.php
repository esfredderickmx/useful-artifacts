<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use SimpleXMLElement;

class DropSchemas extends Command
{
    /**
     * @var string
     */
    protected $signature = 'local:drop-schemas
        {--t|testing : Drop schemas on the testing database configured in phpunit.xml}
        {--b|both : Drop schemas on both the local and phpunit.xml testing databases}';

    /**
     * @var string
     */
    protected $description = 'Drop every non-system schema on local database connections.';

    private const PHPUNIT_CONNECTION = 'phpunit_schema_dropper';

    private const LOCAL_HOSTS = [
        '127.0.0.1',
        '::1',
        'db',
        'database',
        'host.docker.internal',
        'localhost',
        'pgsql',
        'postgres',
        'postgresql',
    ];

    private const PROTECTED_DATABASES = [
        'postgres',
        'template0',
        'template1',
    ];

    public function handle(): int
    {
        if ($this->option('testing') && $this->option('both')) {
            $this->components->error('The -t and -b options are mutually exclusive.');

            return self::FAILURE;
        }

        $this->ensureLocalApplicationEnvironment();

        $total = 0;

        foreach ($this->targetConnections() as $target => $connection) {
            $total += $this->dropSchemas($target, $connection);
        }

        $this->components->info("Dropped {$total} schema(s).");

        return self::SUCCESS;
    }

    /**
     * @return array<string, Connection>
     */
    private function targetConnections(): array
    {
        if ($this->option('both')) {
            return [
                'local' => $this->localConnection(),
                'phpunit testing' => $this->phpunitConnection(),
            ];
        }

        if ($this->option('testing')) {
            return [
                'phpunit testing' => $this->phpunitConnection(),
            ];
        }

        return [
            'local' => $this->localConnection(),
        ];
    }

    private function localConnection(): Connection
    {
        return $this->verifiedLocalConnection('pgsql', 'local');
    }

    private function phpunitConnection(): Connection
    {
        config([
            'database.connections.'.self::PHPUNIT_CONNECTION => $this->phpunitDatabaseConfig(),
        ]);

        DB::purge(self::PHPUNIT_CONNECTION);

        return $this->verifiedLocalConnection(self::PHPUNIT_CONNECTION, 'phpunit testing');
    }

    private function verifiedLocalConnection(string $connectionName, string $target): Connection
    {
        $connection = DB::connection($connectionName);

        if ($connection->getDriverName() !== 'pgsql') {
            throw new RuntimeException("The [{$target}] database connection must use the pgsql driver.");
        }

        $this->ensureLocalDatabaseConnection($target, $connection);

        return $connection;
    }

    private function dropSchemas(string $target, Connection $connection): int
    {
        $database = $connection->getDatabaseName();
        $schemas = $this->schemas($connection);

        if ($schemas === []) {
            $this->components->info("No non-system schemas found on [{$target}] database [{$database}].");

            return 0;
        }

        $this->components->warn('Dropping '.count($schemas)." schema(s) on [{$target}] database [{$database}].");

        foreach ($schemas as $schema) {
            $this->line(" - {$schema}");

            $connection->statement('drop schema if exists '.$this->quoteIdentifier($schema).' cascade');
        }

        if (in_array('public', $schemas, true)) {
            $connection->statement('create schema if not exists public');
        }

        return count($schemas);
    }

    /**
     * @return list<string>
     */
    private function schemas(Connection $connection): array
    {
        $rows = $connection->select(<<<'SQL'
            select nspname
            from pg_namespace
            where nspname <> 'information_schema'
              and nspname not like 'pg\_%' escape '\'
            order by nspname
            SQL);

        $schemas = [];

        foreach ($rows as $row) {
            if (! is_object($row)) {
                continue;
            }

            $values = get_object_vars($row);

            if (! array_key_exists('nspname', $values)) {
                continue;
            }

            $schemas[] = (string) $values['nspname'];
        }

        return $schemas;
    }

    /**
     * @return array<string, mixed>
     */
    private function phpunitDatabaseConfig(): array
    {
        $variables = $this->phpunitEnvironmentVariables();
        $connectionName = $variables['DB_CONNECTION'] ?? 'pgsql';

        if ($connectionName !== 'pgsql') {
            throw new RuntimeException('phpunit.xml must point DB_CONNECTION to [pgsql] before schemas can be dropped.');
        }

        if (! array_key_exists('DB_DATABASE', $variables) || $variables['DB_DATABASE'] === '') {
            throw new RuntimeException('phpunit.xml must define DB_DATABASE before the testing database can be targeted.');
        }

        $config = config('database.connections.pgsql');

        if (! is_array($config)) {
            throw new RuntimeException('The [pgsql] database connection is not configured.');
        }

        $overrides = [
            'DB_URL' => 'url',
            'DB_HOST' => 'host',
            'DB_PORT' => 'port',
            'DB_DATABASE' => 'database',
            'DB_USERNAME' => 'username',
            'DB_PASSWORD' => 'password',
            'DB_CHARSET' => 'charset',
            'DB_SSLMODE' => 'sslmode',
        ];

        foreach ($overrides as $environmentKey => $configKey) {
            if (array_key_exists($environmentKey, $variables)) {
                $config[$configKey] = $variables[$environmentKey];
            }
        }

        return $config;
    }

    /**
     * @return array<string, string>
     */
    private function phpunitEnvironmentVariables(): array
    {
        $path = base_path('phpunit.xml');

        if (! is_file($path)) {
            throw new RuntimeException('The phpunit.xml file could not be found.');
        }

        $document = simplexml_load_file($path);

        if (! $document instanceof SimpleXMLElement) {
            throw new RuntimeException('The phpunit.xml file could not be read.');
        }

        $nodes = $document->xpath('/phpunit/php/env');

        if (! is_array($nodes)) {
            throw new RuntimeException('The phpunit.xml environment variables could not be read.');
        }

        $variables = [];

        foreach ($nodes as $node) {
            $name = (string) $node['name'];

            if ($name === '') {
                continue;
            }

            $variables[$name] = (string) $node['value'];
        }

        return $variables;
    }

    private function ensureLocalApplicationEnvironment(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('This command may only run when APP_ENV is [local].');
        }
    }

    private function ensureLocalDatabaseConnection(string $target, Connection $connection): void
    {
        $config = $connection->getConfig();

        if (! is_array($config)) {
            throw new RuntimeException("The [{$target}] database connection configuration could not be read.");
        }

        $database = $connection->getDatabaseName();

        if ($database === '' || in_array($database, self::PROTECTED_DATABASES, true)) {
            throw new RuntimeException("Refusing to drop schemas on protected database [{$database}] for [{$target}].");
        }

        $host = $this->configuredHost($config);

        if (! $this->isLocalHost($host)) {
            $displayHost = $host ?? 'unknown';

            throw new RuntimeException("Refusing to drop schemas on [{$target}] because host [{$displayHost}] is not recognized as local.");
        }

        $serverAddress = $this->serverAddress($connection);

        if ($this->requiresLoopbackServerAddress($host) && $serverAddress !== null && ! $this->isLoopbackAddress($serverAddress)) {
            throw new RuntimeException("Refusing to drop schemas on [{$target}] because PostgreSQL reported non-local address [{$serverAddress}].");
        }
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function configuredHost(array $config): ?string
    {
        $url = $this->stringConfigValue($config, 'url');

        if ($url !== null) {
            $host = parse_url($url, PHP_URL_HOST);

            if (is_string($host) && $host !== '') {
                return trim($host, '[]');
            }
        }

        return $this->stringConfigValue($config, 'host');
    }

    /**
     * @param  array<string, mixed>  $config
     */
    private function stringConfigValue(array $config, string $key): ?string
    {
        if (! array_key_exists($key, $config) || $config[$key] === null) {
            return null;
        }

        $value = trim((string) $config[$key]);

        return $value === '' ? null : $value;
    }

    private function serverAddress(Connection $connection): ?string
    {
        $address = $connection->scalar('select inet_server_addr()::text');

        if (! is_string($address) || $address === '') {
            return null;
        }

        return $this->normalizeAddress($address);
    }

    private function requiresLoopbackServerAddress(?string $host): bool
    {
        return $host === null || str_starts_with($host, '/') || $this->isLoopbackAddress($host);
    }

    private function isLocalHost(?string $host): bool
    {
        if ($host === null || str_starts_with($host, '/')) {
            return true;
        }

        $normalizedHost = mb_strtolower(trim($host, '[]'));

        if (in_array($normalizedHost, self::LOCAL_HOSTS, true)) {
            return true;
        }

        return $this->isLoopbackAddress($normalizedHost);
    }

    private function isLoopbackAddress(string $host): bool
    {
        $normalizedHost = $this->normalizeAddress($host);

        if (filter_var($normalizedHost, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            return str_starts_with($normalizedHost, '127.');
        }

        return in_array($normalizedHost, ['::1', '0:0:0:0:0:0:0:1'], true);
    }

    private function normalizeAddress(string $address): string
    {
        $normalizedAddress = trim($address);

        if (str_starts_with($normalizedAddress, '[')) {
            $closingBracketPosition = strpos($normalizedAddress, ']');

            if ($closingBracketPosition !== false) {
                $normalizedAddress = substr($normalizedAddress, 1, $closingBracketPosition - 1);
            }
        }

        if (str_contains($normalizedAddress, '/')) {
            $normalizedAddress = explode('/', $normalizedAddress, 2)[0];
        }

        return trim($normalizedAddress, '[]');
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
}
