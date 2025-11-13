-- Add SendCloud shipping method ID to transporteur_service
ALTER TABLE transporteur_service 
ADD COLUMN IF NOT EXISTS sendcloud_shipping_method_id VARCHAR(100);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_transporteur_service_sendcloud_id 
ON transporteur_service(sendcloud_shipping_method_id);

-- Add comment for documentation
COMMENT ON COLUMN transporteur_service.sendcloud_shipping_method_id IS 'SendCloud shipping method ID for automatic import and synchronization';