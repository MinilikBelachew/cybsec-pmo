-- Grant necessary permissions to the database user
ALTER SCHEMA public OWNER TO postgres;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON DATABASE cybsec_pmo TO postgres;
