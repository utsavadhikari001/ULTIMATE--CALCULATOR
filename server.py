import http.server
import socketserver
import webbrowser
import json
import os
import sqlite3
import sympy as sp
import ast
import re
from urllib.parse import parse_qs, urlparse
import threading
import time
import math

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, 'calculator.db')


def get_connection():
    return sqlite3.connect(DATABASE_PATH, timeout=5)


def parse_symbolic_expression(expression, variable):
    """Parse a small, explicit subset of SymPy syntax used by the calculator."""
    expression = expression.strip()
    if len(expression) > 500:
        raise ValueError('Expression is too long')
    if not variable.isidentifier() or variable.startswith('_'):
        raise ValueError('Variable must be a valid name')
    if not re.fullmatch(r'[0-9A-Za-z_+\-*/^().,\s]+', expression):
        raise ValueError('Expression contains unsupported characters')

    symbol = sp.Symbol(variable)
    allowed = {
        variable: symbol,
        'sin': sp.sin,
        'cos': sp.cos,
        'tan': sp.tan,
        'asin': sp.asin,
        'acos': sp.acos,
        'atan': sp.atan,
        'sinh': sp.sinh,
        'cosh': sp.cosh,
        'tanh': sp.tanh,
        'log': sp.log,
        'sqrt': sp.sqrt,
        'exp': sp.exp,
        'Abs': sp.Abs,
        'pi': sp.pi,
        'E': sp.E,
        'oo': sp.oo,
    }
    identifiers = set(re.findall(r'[A-Za-z_]\w*', expression))
    if not identifiers.issubset(allowed):
        raise ValueError('Expression contains an unsupported function or symbol')
    return sp.sympify(expression.replace('^', '**'), locals=allowed), symbol


def evaluate_numeric_expression(expression, angle_mode):
    """Evaluate calculator arithmetic without exposing Python's eval()."""
    expression = expression.strip()
    if len(expression) > 500:
        raise ValueError('Expression is too long')
    expression = (expression.replace('×', '*').replace('÷', '/')
                             .replace('π', 'pi').replace('√(', 'sqrt(')
                             .replace('∛(', 'cbrt(').replace('^', '**'))
    tree = ast.parse(expression, mode='eval')

    def to_radians(value):
        if angle_mode == 'deg':
            return math.radians(value)
        if angle_mode == 'grad':
            return math.radians(value * 0.9)
        return value

    functions = {
        'sin': lambda value: math.sin(to_radians(value)),
        'cos': lambda value: math.cos(to_radians(value)),
        'tan': lambda value: math.tan(to_radians(value)),
        'log': math.log10,
        'ln': math.log,
        'sqrt': math.sqrt,
        'cbrt': getattr(math, 'cbrt', lambda value: value ** (1 / 3)),
        'abs': abs,
    }
    constants = {'pi': math.pi, 'e': math.e}
    operators = {
        ast.Add: lambda left, right: left + right,
        ast.Sub: lambda left, right: left - right,
        ast.Mult: lambda left, right: left * right,
        ast.Div: lambda left, right: left / right,
        ast.Mod: lambda left, right: left % right,
        ast.Pow: lambda left, right: left ** right,
    }

    def evaluate(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.Name) and node.id in constants:
            return constants[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = evaluate(node.operand)
            return value if isinstance(node.op, ast.UAdd) else -value
        if isinstance(node, ast.BinOp) and type(node.op) in operators:
            return operators[type(node.op)](evaluate(node.left), evaluate(node.right))
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                and node.func.id in functions and len(node.args) == 1 and not node.keywords):
            return functions[node.func.id](evaluate(node.args[0]))
        raise ValueError('Expression contains an unsupported operation')

    result = evaluate(tree.body)
    if not isinstance(result, (int, float)) or not math.isfinite(result):
        raise ValueError('Calculation did not produce a finite number')
    return result


class CalculatorHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve from current directory
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)
    
    def do_GET(self):
        performance_monitor.increment()
        
        if self.path == '/':
            # Redirect to calculator.html
            self.send_response(302)
            self.send_header('Location', '/calculator.html')
            self.end_headers()
        elif self.path == '/history':
            self.send_history()
        elif self.path == '/graph':
            self.send_graph_data()
        elif self.path == '/constants':
            self.send_constants()
        elif self.path == '/units':
            self.send_units()
        elif self.path.startswith('/solve'):
            self.solve_equation()
        elif self.path.startswith('/differentiate'):
            self.differentiate()
        elif self.path.startswith('/integrate'):
            self.integrate()
        elif self.path.startswith('/limit'):
            self.compute_limit()
        elif self.path.startswith('/series'):
            self.compute_series()
        elif self.path == '/performance':
            self.send_performance_stats()
        elif self.path == '/settings':
            self.get_settings()
        elif self.path == '/health':
            self.health_check()
        else:
            # Serve static files
            super().do_GET()
    
    def do_POST(self):
        performance_monitor.increment()
        
        if self.path == '/save_history':
            self.save_history()
        elif self.path == '/save_graph':
            self.save_graph()
        elif self.path == '/save_plot':
            self.save_plot()
        elif self.path == '/save_settings':
            self.save_settings()
        elif self.path == '/calculate':
            self.calculate_expression()
        elif self.path == '/clear_history':
            self.clear_history()
        else:
            self.send_error(404, f"Endpoint not found: {self.path}")
    
    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def send_json_response(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def send_error_response(self, message, status=500):
        self.send_json_response({'error': message}, status)
    
    def send_history(self):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT expression, result, timestamp FROM history ORDER BY timestamp DESC LIMIT 100")
            history = [{'expr': row[0], 'result': row[1], 'time': row[2]} for row in cursor.fetchall()]
            conn.close()
            
            self.send_json_response(history)
        except Exception as e:
            self.send_error_response(f"Failed to fetch history: {str(e)}")
    
    def save_history(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode())
            
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO history (expression, result) VALUES (?, ?)", 
                          (data['expr'], data['result']))
            conn.commit()
            conn.close()
            
            self.send_json_response({'status': 'success'})
        except Exception as e:
            self.send_error_response(f"Failed to save history: {str(e)}")
    
    def clear_history(self):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM history")
            conn.commit()
            conn.close()
            
            self.send_json_response({'status': 'success', 'message': 'History cleared'})
        except Exception as e:
            self.send_error_response(f"Failed to clear history: {str(e)}")
    
    def send_graph_data(self):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT x, y FROM graph_data ORDER BY id DESC LIMIT 100")
            data = [{'x': row[0], 'y': row[1]} for row in cursor.fetchall()]
            conn.close()
            
            self.send_json_response(data)
        except Exception as e:
            self.send_error_response(f"Failed to fetch graph data: {str(e)}")
    
    def save_graph(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode())
            
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO graph_data (x, y) VALUES (?, ?)", 
                          (data['x'], data['y']))
            conn.commit()
            conn.close()
            
            self.send_json_response({'status': 'success'})
        except Exception as e:
            self.send_error_response(f"Failed to save graph data: {str(e)}")
    
    def save_plot(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode())
            
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("INSERT INTO plots (name, data) VALUES (?, ?)", 
                          (data['name'], json.dumps(data['data'])))
            conn.commit()
            conn.close()
            
            self.send_json_response({'status': 'success'})
        except Exception as e:
            self.send_error_response(f"Failed to save plot: {str(e)}")
    
    def send_constants(self):
        constants = {
            'π': '3.141592653589793',
            'e': '2.718281828459045',
            'φ': '1.618033988749895',
            'c': '299792458',
            'G': '6.67430e-11',
            'h': '6.62607015e-34',
            'k': '1.380649e-23',
            'ε0': '8.8541878128e-12',
            'μ0': '1.25663706212e-6',
            'NA': '6.02214076e23',
            'R': '8.314462618',
            'σ': '5.670374419e-8',
            'α': '7.2973525693e-3',
            'me': '9.1093837015e-31',
            'mp': '1.67262192369e-27'
        }
        
        self.send_json_response(constants)
    
    def send_units(self):
        units = {
            'length': ['m', 'cm', 'mm', 'km', 'in', 'ft', 'yd', 'mi'],
            'mass': ['kg', 'g', 'mg', 'lb', 'oz'],
            'time': ['s', 'min', 'h', 'day', 'week', 'year'],
            'temperature': ['K', '°C', '°F'],
            'energy': ['J', 'kJ', 'cal', 'kcal', 'eV', 'Wh'],
            'power': ['W', 'kW', 'MW', 'hp'],
            'pressure': ['Pa', 'kPa', 'MPa', 'bar', 'atm', 'psi'],
            'angle': ['rad', 'deg', 'grad']
        }
        
        self.send_json_response(units)
    
    def solve_equation(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            equation = query.get('eq', [''])[0]
            variable = query.get('var', ['x'])[0]
            
            if not equation:
                self.send_error_response("Equation parameter is required", 400)
                return
            
            if equation.count('=') > 1:
                raise ValueError('Use only one equals sign')
            if '=' in equation:
                left, right = equation.split('=', 1)
                left_expr, x = parse_symbolic_expression(left, variable)
                right_expr, _ = parse_symbolic_expression(right, variable)
                eq = left_expr - right_expr
            else:
                eq, x = parse_symbolic_expression(equation, variable)
            solutions = sp.solve(eq, x)
            
            result = [str(sol.evalf()) for sol in solutions]
            
            self.send_json_response({'solutions': result})
        except Exception as e:
            self.send_error_response(f"Failed to solve equation: {str(e)}")
    
    def differentiate(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            expression = query.get('expr', [''])[0]
            variable = query.get('var', ['x'])[0]
            
            if not expression:
                self.send_error_response("Expression parameter is required", 400)
                return
            
            expr, x = parse_symbolic_expression(expression, variable)
            derivative = sp.diff(expr, x)
            
            self.send_json_response({
                'derivative': str(derivative),
                'latex': sp.latex(derivative)
            })
        except Exception as e:
            self.send_error_response(f"Failed to differentiate: {str(e)}")
    
    def integrate(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            expression = query.get('expr', [''])[0]
            variable = query.get('var', ['x'])[0]
            lower = query.get('lower', [None])[0]
            upper = query.get('upper', [None])[0]
            
            if not expression:
                self.send_error_response("Expression parameter is required", 400)
                return
            
            expr, x = parse_symbolic_expression(expression, variable)

            if lower not in (None, '') and upper not in (None, ''):
                lower_expr, _ = parse_symbolic_expression(lower, variable)
                upper_expr, _ = parse_symbolic_expression(upper, variable)
                definite = sp.integrate(expr, (x, lower_expr, upper_expr))
                self.send_json_response({
                    'value': str(definite),
                    'numeric': str(sp.N(definite)) if definite.is_number else None,
                    'latex': sp.latex(definite)
                })
                return

            integral = sp.integrate(expr, x)
            
            self.send_json_response({
                'integral': str(integral),
                'latex': sp.latex(integral)
            })
        except Exception as e:
            self.send_error_response(f"Failed to integrate: {str(e)}")

    def compute_limit(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            expression = query.get('expr', [''])[0]
            variable = query.get('var', ['x'])[0]
            point = query.get('point', ['0'])[0]

            if not expression:
                self.send_error_response("Expression parameter is required", 400)
                return

            expr, x = parse_symbolic_expression(expression, variable)
            point_expr, _ = parse_symbolic_expression(point or '0', variable)
            result = sp.limit(expr, x, point_expr)

            self.send_json_response({
                'limit': str(result),
                'latex': sp.latex(result)
            })
        except Exception as e:
            self.send_error_response(f"Failed to compute limit: {str(e)}")

    def compute_series(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            expression = query.get('expr', [''])[0]
            variable = query.get('var', ['x'])[0]
            point = query.get('point', ['0'])[0]
            order = query.get('order', ['6'])[0]

            if not expression:
                self.send_error_response("Expression parameter is required", 400)
                return

            try:
                order_int = int(order)
                if not (1 <= order_int <= 15):
                    raise ValueError()
            except ValueError:
                self.send_error_response("Order must be a whole number between 1 and 15", 400)
                return

            expr, x = parse_symbolic_expression(expression, variable)
            point_expr, _ = parse_symbolic_expression(point or '0', variable)
            expansion = sp.series(expr, x, point_expr, order_int).removeO()

            self.send_json_response({
                'series': str(expansion),
                'latex': sp.latex(expansion)
            })
        except Exception as e:
            self.send_error_response(f"Failed to compute series: {str(e)}")
    
    def calculate_expression(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode())
            
            expression = data.get('expression', '')
            angle_mode = data.get('angle_mode', 'rad')
            
            if not expression:
                self.send_error_response("Expression is required", 400)
                return
            
            result = evaluate_numeric_expression(expression, angle_mode)
            
            self.send_json_response({'result': result})
            
        except Exception as e:
            self.send_error_response(f"Calculation error: {str(e)}")
    
    def send_performance_stats(self):
        stats = performance_monitor.get_stats()
        self.send_json_response(stats)
    
    def get_settings(self):
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT theme, precision, angle_mode, notation FROM user_settings WHERE id = 1")
            row = cursor.fetchone()
            conn.close()
            
            if row:
                settings = {
                    'theme': row[0],
                    'precision': row[1],
                    'angle_mode': row[2],
                    'notation': row[3]
                }
            else:
                settings = {
                    'theme': 'dark',
                    'precision': 10,
                    'angle_mode': 'deg',
                    'notation': 'auto'
                }
            
            self.send_json_response(settings)
        except Exception as e:
            self.send_error_response(f"Failed to get settings: {str(e)}")
    
    def save_settings(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode())
            
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO user_settings (id, theme, precision, angle_mode, notation) 
                VALUES (1, ?, ?, ?, ?)
            ''', (data.get('theme'), data.get('precision'), data.get('angle_mode'), data.get('notation')))
            conn.commit()
            conn.close()
            
            self.send_json_response({'status': 'success'})
        except Exception as e:
            self.send_error_response(f"Failed to save settings: {str(e)}")
    
    def health_check(self):
        self.send_json_response({
            'status': 'healthy',
            'timestamp': time.time(),
            'version': '1.1.0'
        })
    
    def log_message(self, format, *args):
        # Custom log format with timestamp
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        print(f"{timestamp} - {format % args}")

def init_database():
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expression TEXT NOT NULL,
            result TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS graph_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            x REAL NOT NULL,
            y REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            theme TEXT DEFAULT 'dark',
            precision INTEGER DEFAULT 10,
            angle_mode TEXT DEFAULT 'deg',
            notation TEXT DEFAULT 'auto'
        )
    ''')
    
    # Insert default settings if not exists
    cursor.execute('INSERT OR IGNORE INTO user_settings (id) VALUES (1)')
    
    conn.commit()
    conn.close()

class PerformanceMonitor:
    def __init__(self):
        self.requests = 0
        self.start_time = time.time()
        self.endpoint_stats = {}
    
    def increment(self, endpoint=None):
        self.requests += 1
        if endpoint:
            self.endpoint_stats[endpoint] = self.endpoint_stats.get(endpoint, 0) + 1
    
    def get_stats(self):
        uptime = time.time() - self.start_time
        return {
            'requests': self.requests,
            'uptime': uptime,
            'rps': self.requests / uptime if uptime > 0 else 0,
            'endpoint_stats': self.endpoint_stats
        }


class CalculatorServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


# Global performance monitor
performance_monitor = PerformanceMonitor()

if __name__ == "__main__":
    # Ensure we're in the right directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    init_database()
    
    # Check if calculator.html exists
    if not os.path.exists('calculator.html'):
        print("❌ Error: calculator.html not found in current directory!")
        print("💡 Please ensure the HTML file is in the same directory as this script.")
        exit(1)
    
    with CalculatorServer(("127.0.0.1", PORT), CalculatorHandler) as httpd:
        print(f"🚀 Ultimate Calculator Server running at http://localhost:{PORT}")
        print("📊 Features: Symbolic Math, 3D Graphing, Unit Conversion, Calculus")
        print("⚡ Performance monitoring enabled")
        print("🔧 Advanced mathematical backend with SymPy")
        print("🌐 Opening browser automatically...")
        
        # Try to open browser
        try:
            webbrowser.open(f'http://localhost:{PORT}')
        except Exception as e:
            print(f"⚠️  Could not open browser automatically: {e}")
            print(f"💡 Please manually navigate to: http://localhost:{PORT}")
        
        # Start performance monitoring in background
        def monitor_performance():
            while True:
                time.sleep(60)
                stats = performance_monitor.get_stats()
                print(f"📈 Performance: {stats['requests']} requests, {stats['rps']:.2f} req/sec")
                if stats['endpoint_stats']:
                    print(f"📊 Endpoint stats: {stats['endpoint_stats']}")
        
        monitor_thread = threading.Thread(target=monitor_performance, daemon=True)
        monitor_thread.start()
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Shutting down server...")
            final_stats = performance_monitor.get_stats()
            print(f"📊 Final Stats: {final_stats['requests']} total requests")
            if final_stats['endpoint_stats']:
                print(f"📈 Endpoint usage: {final_stats['endpoint_stats']}")