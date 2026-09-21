import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { parsePythonModule } from './structure';
import { tokenizePython } from './tokenizer';
import {
  extractPythonDataAccess,
  extractPythonEnvironmentKeys,
  extractPythonEvents,
  extractPythonModels,
  extractPythonOutboundCalls,
  extractPythonRoutes,
  extractPythonTasks,
  extractPythonTests,
} from './routes';
import { parsePythonVersion, resolvePinnedVersion, satisfiesPythonSpecifier } from './version';
import { parseToml, tomlPath } from './toml';
import { discoverPythonProjects, normalizePoetrySpecifier, parseRequirementLine } from './manifest';
import { detectPythonFrameworks } from './frameworks';
import { findPythonEntryPoints, primaryEntryPoint } from './entrypoints';

function workspace(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tellann-python-'));
  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(root, relative.replaceAll('/', path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }
  return root;
}

test('tokenizer keeps strings, comments and triple quotes out of the structure', () => {
  const tokens = tokenizePython([
    'x = "a(b"  # def not_a_function():',
    "y = '''",
    'def also_not_a_function():',
    "'''",
    'def real(a, b):',
    '    return a',
  ].join('\n'));
  const names = tokens.filter((token) => token.type === 'name').map((token) => token.value);
  assert.deepEqual(names, ['x', 'y', 'def', 'real', 'a', 'b', 'return', 'a']);
});

test('tokenizer handles f-strings and prefixed literals', () => {
  const tokens = tokenizePython('url = f"/users/{user.id}"\nraw = r"\\d+"\n');
  const strings = tokens.filter((token) => token.type === 'string');
  assert.equal(strings.length, 2);
  assert.equal(strings[0].prefix, 'f');
  assert.equal(strings[0].stringValue, '/users/{user.id}');
  assert.equal(strings[1].prefix, 'r');
});

test('module structure records nesting, decorators and async definitions', () => {
  const module = parsePythonModule([
    'import os',
    'from fastapi import APIRouter, FastAPI',
    '',
    'class UserService:',
    '    """Docs."""',
    '',
    '    async def fetch(self, user_id):',
    '        return user_id',
    '',
    '@router.get("/users/{user_id}")',
    'async def read_user(user_id: int):',
    '    return {}',
  ].join('\n'), 'app/main.py');

  const service = module.declarations.find((item) => item.name === 'UserService');
  assert.ok(service);
  assert.equal(service.kind, 'class');
  assert.equal(service.docstring, 'Docs.');
  assert.equal(service.children.length, 1);
  assert.equal(service.children[0].qualifiedName, 'UserService.fetch');
  assert.equal(service.children[0].isAsync, true);
  assert.deepEqual(service.children[0].parameters, ['self', 'user_id']);

  const handler = module.declarations.find((item) => item.name === 'read_user');
  assert.ok(handler);
  assert.equal(handler.decorators[0].name, 'router.get');
  assert.equal(handler.decorators[0].args[0].stringValue, '/users/{user_id}');

  assert.equal(module.imports.length, 2);
  assert.equal(module.imports[1].module, 'fastapi');
  assert.deepEqual(module.imports[1].names.map((item) => item.name), ['APIRouter', 'FastAPI']);
});

test('dedent after a nested block closes only the blocks it should', () => {
  const module = parsePythonModule([
    'def outer():',
    '    if True:',
    '        def inner():',
    '            pass',
    '    return 1',
    '',
    'def sibling():',
    '    pass',
  ].join('\n'), 'x.py');

  const outer = module.root.children.find((item) => item.name === 'outer');
  const sibling = module.root.children.find((item) => item.name === 'sibling');
  assert.ok(outer && sibling, 'both top-level functions are module children');
  assert.equal(module.root.children.length, 2);
  assert.equal(outer.children[0]?.name, 'inner');
});

test('FastAPI routes compose router prefixes', () => {
  const module = parsePythonModule([
    'from fastapi import APIRouter, FastAPI',
    '',
    'app = FastAPI()',
    'router = APIRouter(prefix="/api/v1")',
    '',
    '@router.get("/users")',
    'async def list_users():',
    '    return []',
    '',
    '@router.post("/users/{user_id}/activate")',
    'async def activate(user_id: int):',
    '    return {}',
    '',
    '@app.get("/health")',
    'def health():',
    '    return "ok"',
  ].join('\n'), 'app/main.py');

  const routes = extractPythonRoutes(module);
  const spellings = routes.map((route) => `${route.method} ${route.route}`).sort();
  assert.deepEqual(spellings, [
    'GET /api/v1/users',
    'GET /health',
    'POST /api/v1/users/{user_id}/activate',
  ]);
  assert.equal(routes.find((route) => route.route === '/api/v1/users')?.handler, 'list_users');
});

test('Flask routes read the methods list and blueprint prefix', () => {
  const module = parsePythonModule([
    'from flask import Blueprint, Flask',
    '',
    'app = Flask(__name__)',
    'orders = Blueprint("orders", __name__, url_prefix="/orders")',
    '',
    '@orders.route("/<int:order_id>", methods=["GET", "DELETE"])',
    'def order_detail(order_id):',
    '    return {}',
    '',
    '@app.route("/")',
    'def index():',
    '    return "home"',
  ].join('\n'), 'app.py');

  const routes = extractPythonRoutes(module);
  const spellings = routes.map((route) => `${route.method} ${route.route}`).sort();
  assert.deepEqual(spellings, ['DELETE /orders/{order_id}', 'GET /', 'GET /orders/{order_id}']);
});

test('Django urls and DRF routers produce endpoints', () => {
  const module = parsePythonModule([
    'from django.urls import include, path',
    'from rest_framework.routers import DefaultRouter',
    'from . import views',
    '',
    'router = DefaultRouter()',
    'router.register(r"invoices", views.InvoiceViewSet)',
    '',
    'urlpatterns = [',
    '    path("users/<int:pk>/", views.user_detail, name="user-detail"),',
    '    path("api/", include(router.urls)),',
    ']',
  ].join('\n'), 'project/urls.py');

  const routes = extractPythonRoutes(module);
  const paths = routes.map((route) => route.route);
  assert.ok(paths.includes('/users/{pk}/'), `expected the Django path, saw ${paths.join(', ')}`);
  assert.ok(paths.includes('/invoices'), 'DRF router registration expands to a collection route');
  assert.ok(paths.includes('/invoices/{pk}'), 'DRF router registration expands to a detail route');
  assert.equal(routes.find((route) => route.route === '/users/{pk}/')?.handler, 'views.user_detail');
});

test('Django class-based views contribute their HTTP methods', () => {
  const module = parsePythonModule([
    'from django.views import View',
    '',
    'class InvoiceView(View):',
    '    def get(self, request):',
    '        return None',
    '',
    '    def post(self, request):',
    '        return None',
    '',
    '    def helper(self):',
    '        return None',
  ].join('\n'), 'app/views.py');

  const routes = extractPythonRoutes(module).filter((route) => route.kind === 'django-view-method');
  assert.deepEqual(routes.map((route) => route.method).sort(), ['GET', 'POST']);
  assert.equal(routes[0].handler, 'InvoiceView.get');
});

test('models and data access are read for Django and SQLAlchemy', () => {
  const django = parsePythonModule([
    'from django.db import models',
    '',
    'class Invoice(models.Model):',
    '    total = models.IntegerField()',
    '',
    'def pay(invoice_id):',
    '    invoice = Invoice.objects.get(pk=invoice_id)',
    '    Invoice.objects.filter(pk=invoice_id).update(paid=True)',
    '    return invoice',
  ].join('\n'), 'billing/models.py');

  assert.deepEqual(extractPythonModels(django).map((model) => model.name), ['Invoice']);
  const access = extractPythonDataAccess(django);
  assert.deepEqual(access.map((item) => `${item.model}.${item.operation}`).sort(), ['Invoice.filter', 'Invoice.get']);
  assert.equal(access.every((item) => item.orm === 'django'), true);

  const sqlalchemy = parsePythonModule([
    'from sqlalchemy.orm import DeclarativeBase',
    '',
    'class Base(DeclarativeBase):',
    '    pass',
    '',
    'class Account(Base):',
    '    __tablename__ = "accounts"',
    '',
    'def load(session, account_id):',
    '    return session.query(Account).get(account_id)',
  ].join('\n'), 'db/models.py');

  const models = extractPythonModels(sqlalchemy);
  assert.equal(models.find((model) => model.name === 'Account')?.table, 'accounts');
  assert.ok(extractPythonDataAccess(sqlalchemy).some((item) => item.orm === 'sqlalchemy'));
});

test('tasks, outbound calls, events, environment keys and tests are recognized', () => {
  const module = parsePythonModule([
    'import os',
    'import requests',
    'from celery import shared_task',
    '',
    'API = os.getenv("BILLING_API_URL")',
    'SECRET = os.environ["STRIPE_KEY"]',
    '',
    '@shared_task',
    'def sync_invoices():',
    '    requests.post("https://api.stripe.com/v1/invoices", json={})',
    '    notify.delay("invoice.synced")',
    '',
    'def test_sync_invoices():',
    '    assert True',
  ].join('\n'), 'billing/tasks.py');

  assert.deepEqual(extractPythonTasks(module).map((task) => task.name), ['sync_invoices']);
  const outbound = extractPythonOutboundCalls(module);
  assert.deepEqual(outbound.map((call) => `${call.method} ${call.target}`), ['POST https://api.stripe.com/v1/invoices']);
  assert.ok(extractPythonEvents(module).some((event) => event.name === 'invoice.synced' && event.publishes));
  assert.deepEqual(extractPythonEnvironmentKeys(module), ['BILLING_API_URL', 'STRIPE_KEY']);
  assert.deepEqual(extractPythonTests(module).map((item) => item.name), ['test_sync_invoices']);
});

test('PEP 440 ordering and specifier sets', () => {
  assert.ok(satisfiesPythonSpecifier('4.2.11', '>=3.2,<6'));
  assert.ok(!satisfiesPythonSpecifier('6.0', '>=3.2,<6'));
  assert.ok(satisfiesPythonSpecifier('0.110.0', '>=0.95,<1'));
  assert.ok(!satisfiesPythonSpecifier('1.0.0', '>=0.95,<1'));
  // A pre-release only matches when the specifier itself mentions one.
  assert.ok(!satisfiesPythonSpecifier('5.0rc1', '>=4.2,<6'));
  assert.ok(satisfiesPythonSpecifier('5.0rc1', '>=5.0rc1'));
  assert.ok(satisfiesPythonSpecifier('2.3.7', '~=2.3.1'));
  assert.ok(!satisfiesPythonSpecifier('2.4.0', '~=2.3.1'));
  assert.ok(satisfiesPythonSpecifier('1.2.9', '==1.2.*'));
  assert.equal(parsePythonVersion('1!2.0')?.epoch, 1);
  assert.equal(resolvePinnedVersion('>=4.2,<6'), '4.2');
  assert.equal(resolvePinnedVersion('==3.1.4'), '3.1.4');
});

test('poetry ranges become PEP 440 specifier sets', () => {
  assert.equal(normalizePoetrySpecifier('^4.2'), '>=4.2,<5.0.0');
  assert.equal(normalizePoetrySpecifier('^0.110'), '>=0.110,<0.111.0');
  assert.equal(normalizePoetrySpecifier('~2.3'), '>=2.3,<2.4.0');
  assert.ok(satisfiesPythonSpecifier('4.2.11', normalizePoetrySpecifier('^4.2')));
});

test('requirement lines parse names, extras, markers and comments', () => {
  assert.deepEqual(parseRequirementLine('Django>=4.2,<6  # web'), { name: 'django', specifier: '>=4.2,<6' });
  assert.deepEqual(parseRequirementLine('uvicorn[standard]==0.30.1'), { name: 'uvicorn', specifier: '==0.30.1' });
  assert.deepEqual(parseRequirementLine('pytest ; python_version >= "3.9"'), { name: 'pytest', specifier: '' });
  assert.equal(parseRequirementLine('-r base.txt'), null);
  assert.equal(parseRequirementLine('# a comment'), null);
});

test('TOML subset reads pyproject shapes', () => {
  const table = parseToml([
    '[project]',
    'name = "billing"',
    'requires-python = ">=3.11"',
    'dependencies = [',
    '  "fastapi>=0.110",',
    '  "uvicorn[standard]",',
    ']',
    '',
    '[tool.poetry.dependencies]',
    'python = "^3.11"',
    'django = { version = "^5.0", extras = ["argon2"] }',
  ].join('\n'));
  assert.equal(tomlPath(table, 'project', 'name'), 'billing');
  assert.deepEqual(tomlPath(table, 'project', 'dependencies'), ['fastapi>=0.110', 'uvicorn[standard]']);
  assert.equal(tomlPath(table, 'tool', 'poetry', 'dependencies', 'django', 'version'), '^5.0');
});

test('a Django project without a manifest is still discovered and detected', () => {
  const root = workspace({
    'manage.py': '#!/usr/bin/env python\nimport os\n',
    'billing/settings.py': 'INSTALLED_APPS = []\nMIDDLEWARE = []\n',
    'billing/urls.py': 'from django.urls import path\nurlpatterns = []\n',
  });

  const projects = discoverPythonProjects(root);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].root, '.');
  assert.equal(projects[0].manager, 'pip');

  const frameworks = detectPythonFrameworks(projects[0], root);
  assert.equal(frameworks.find((item) => item.id === 'django')?.evidence[0], 'project file: manage.py');

  const entryPoints = findPythonEntryPoints(root);
  assert.equal(primaryEntryPoint(entryPoints, ['django-settings'])?.file, 'billing/settings.py');
});

test('manifests merge across requirements, pyproject and Pipfile', () => {
  const root = workspace({
    'pyproject.toml': '[project]\nname = "shop"\ndependencies = ["fastapi>=0.110"]\n\n[project.optional-dependencies]\ndev = ["pytest>=8"]\n',
    'requirements.txt': 'SQLAlchemy==2.0.30\nrequests\n',
    'app/main.py': 'from fastapi import FastAPI\n\napp = FastAPI()\n',
  });

  const [project] = discoverPythonProjects(root);
  assert.equal(project.name, 'shop');
  assert.equal(project.requiresPython, null);
  assert.equal(project.dependencies.fastapi.resolved, '0.110');
  assert.equal(project.dependencies.pytest.development, true);
  assert.equal(project.dependencies.sqlalchemy.resolved, '2.0.30');

  const frameworks = detectPythonFrameworks(project, root);
  assert.equal(frameworks.find((item) => item.id === 'fastapi')?.supported, true);

  const entry = primaryEntryPoint(findPythonEntryPoints(root), ['fastapi-app']);
  assert.equal(entry?.file, 'app/main.py');
  assert.equal(entry?.symbol, 'app');
});

test('an unsupported pin is reported as unsupported rather than undetected', () => {
  const root = workspace({ 'requirements.txt': 'Django==2.2.28\n' });
  const [project] = discoverPythonProjects(root);
  const django = detectPythonFrameworks(project, root).find((item) => item.id === 'django');
  assert.ok(django);
  assert.equal(django.version, '2.2.28');
  assert.equal(django.supported, false);
});

test('a Flask application factory is distinguished from a module-level app', () => {
  const root = workspace({
    'requirements.txt': 'Flask==3.0.3\n',
    'shop/__init__.py': [
      'from flask import Flask',
      '',
      'def create_app():',
      '    app = Flask(__name__)',
      '    return app',
    ].join('\n'),
  });
  const entryPoints = findPythonEntryPoints(root);
  const factory = primaryEntryPoint(entryPoints, ['flask-factory']);
  assert.equal(factory?.file, 'shop/__init__.py');
  assert.equal(factory?.symbol, 'app');
});
