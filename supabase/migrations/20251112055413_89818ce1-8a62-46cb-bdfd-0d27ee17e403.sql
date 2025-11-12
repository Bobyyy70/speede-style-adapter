
-- Create n8n client API keys table for multi-tenant isolation
CREATE TABLE IF NOT EXISTS public.n8n_client_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.client(id) ON DELETE CASCADE NOT NULL,
  api_key_hash TEXT UNIQUE NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT true NOT NULL,
  date_creation TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  derniere_utilisation TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.n8n_client_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can manage API keys
CREATE POLICY "Admins can manage n8n client keys"
ON public.n8n_client_keys FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_n8n_client_keys_api_key_hash ON public.n8n_client_keys(api_key_hash) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_n8n_client_keys_client_id ON public.n8n_client_keys(client_id);

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  identifier TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 0 NOT NULL,
  window_start TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  blocked_until TIMESTAMPTZ,
  last_request TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS on rate limits (admins only)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rate limits"
ON public.rate_limits FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier TEXT,
  _max_requests INTEGER,
  _window_seconds INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_count INTEGER;
  _blocked_until TIMESTAMPTZ;
BEGIN
  -- Check if blocked
  SELECT blocked_until INTO _blocked_until
  FROM rate_limits
  WHERE identifier = _identifier AND blocked_until > NOW();
  
  IF _blocked_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'blocked',
      'blocked_until', _blocked_until
    );
  END IF;
  
  -- Reset window if expired
  UPDATE rate_limits
  SET request_count = 0, window_start = NOW()
  WHERE identifier = _identifier
    AND window_start < NOW() - (_window_seconds || ' seconds')::INTERVAL;
  
  -- Increment and check
  INSERT INTO rate_limits (identifier, request_count, window_start, last_request)
  VALUES (_identifier, 1, NOW(), NOW())
  ON CONFLICT (identifier) DO UPDATE
  SET request_count = rate_limits.request_count + 1,
      last_request = NOW()
  RETURNING request_count INTO _current_count;
  
  IF _current_count > _max_requests THEN
    -- Block for 5 minutes
    UPDATE rate_limits
    SET blocked_until = NOW() + INTERVAL '5 minutes'
    WHERE identifier = _identifier;
    
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'rate_limit_exceeded',
      'blocked_until', NOW() + INTERVAL '5 minutes'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true, 
    'remaining', _max_requests - _current_count
  );
END;
$$;

-- Function to validate n8n API key and get client_id
CREATE OR REPLACE FUNCTION public.validate_n8n_api_key(_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_id UUID;
  _key_hash TEXT;
BEGIN
  -- Hash the API key (using sha256)
  _key_hash := encode(digest(_api_key, 'sha256'), 'hex');
  
  -- Look up the client_id
  SELECT client_id INTO _client_id
  FROM n8n_client_keys
  WHERE api_key_hash = _key_hash
    AND actif = true;
  
  IF _client_id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid or inactive API key'
    );
  END IF;
  
  -- Update last usage
  UPDATE n8n_client_keys
  SET derniere_utilisation = NOW()
  WHERE api_key_hash = _key_hash;
  
  RETURN jsonb_build_object(
    'valid', true,
    'client_id', _client_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_n8n_api_key(TEXT) TO authenticated, anon;

-- Create audit log table for n8n gateway access
CREATE TABLE IF NOT EXISTS public.n8n_gateway_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  api_key_hash TEXT,
  client_id UUID REFERENCES public.client(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  success BOOLEAN NOT NULL,
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.n8n_gateway_audit ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
CREATE POLICY "Admins can view n8n audit logs"
ON public.n8n_gateway_audit FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_n8n_audit_timestamp ON public.n8n_gateway_audit(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_audit_client_id ON public.n8n_gateway_audit(client_id);
