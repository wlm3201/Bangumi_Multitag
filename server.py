import http.server
import socketserver
import webbrowser
import threading

PORT = 3201

def open_browser():
    webbrowser.open(f"http://localhost:{PORT}")

Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}")
    threading.Thread(target=open_browser).start()
    httpd.serve_forever()