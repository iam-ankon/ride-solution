# cars/middleware.py
from django.utils.deprecation import MiddlewareMixin

class DisableCSRFMiddleware(MiddlewareMixin):
    """Disable CSRF for all views - useful for API endpoints"""
    def process_request(self, request):
        setattr(request, '_dont_enforce_csrf_checks', True)


class CorsHeadersMiddleware(MiddlewareMixin):
    """Handle CORS headers for cross-origin requests including mobile"""
    
    def process_response(self, request, response):
        # Get the origin from the request
        origin = request.headers.get('Origin', '')
        
        # Allow all allowed origins
        allowed_origins = [
            'https://otobigo.onrender.com',
            'https://ride-solution-backend-udox.onrender.com',
        ]
        
        # Also allow the backend domain
        if origin in allowed_origins or origin == 'https://ride-solution-backend-udox.onrender.com':
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Credentials'] = 'true'
        
        # Add these headers for mobile support
        response['Access-Control-Allow-Methods'] = 'DELETE, GET, OPTIONS, PATCH, POST, PUT'
        response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with, cache-control, pragma, expires, set-cookie'
        response['Access-Control-Max-Age'] = '86400'
        
        # IMPORTANT: Expose cookies to frontend
        response['Access-Control-Expose-Headers'] = 'set-cookie'
        
        # For OPTIONS preflight requests
        if request.method == 'OPTIONS':
            response['Access-Control-Allow-Headers'] = 'accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with, cache-control, pragma, expires, set-cookie'
            response['Access-Control-Allow-Methods'] = 'DELETE, GET, OPTIONS, PATCH, POST, PUT'
            response['Access-Control-Max-Age'] = '86400'
            response['Content-Length'] = '0'
            response['Content-Type'] = 'text/plain'
            
        return response