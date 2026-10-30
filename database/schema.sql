-- =============================================================================
-- NetOpsAI Database Schema
-- PostgreSQL 16+
-- 6 tables: network_devices, network_links, network_services,
--           network_alarms, network_incidents, agent_execution_logs
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. NETWORK DEVICES
-- =============================================================================
CREATE TABLE IF NOT EXISTS network_devices (
    device_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_name     VARCHAR(100) NOT NULL UNIQUE,
    device_type     VARCHAR(50)  NOT NULL,       -- e.g. Core, Aggregation, Router, DWDM
    vendor          VARCHAR(100),
    model           VARCHAR(100),
    ip_address      INET,
    management_ip   INET,
    location        VARCHAR(200),
    network_role    VARCHAR(50)  NOT NULL
                        CHECK (network_role IN ('core','aggregation','distribution','edge','access','transport','amplifier','other')),
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','inactive','maintenance','decommissioned')),
    metadata        JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_name        ON network_devices(device_name);
CREATE INDEX IF NOT EXISTS idx_devices_status      ON network_devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_network_role ON network_devices(network_role);

-- =============================================================================
-- 2. NETWORK LINKS
-- =============================================================================
CREATE TABLE IF NOT EXISTS network_links (
    link_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    link_name           VARCHAR(200),
    source_device_id    UUID        REFERENCES network_devices(device_id) ON DELETE CASCADE,
    dest_device_id      UUID        REFERENCES network_devices(device_id) ON DELETE CASCADE,
    link_type           VARCHAR(50) NOT NULL
                            CHECK (link_type IN ('fiber','optical','ethernet','mpls','sdh','dwdm','microwave','other')),
    capacity_gbps       NUMERIC(10,3),
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','degraded','down','maintenance')),
    is_protected        BOOLEAN     NOT NULL DEFAULT FALSE,
    latency_ms          NUMERIC(8,3),
    source_interface    VARCHAR(100),
    dest_interface      VARCHAR(100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_links_source ON network_links(source_device_id);
CREATE INDEX IF NOT EXISTS idx_links_dest   ON network_links(dest_device_id);
CREATE INDEX IF NOT EXISTS idx_links_status ON network_links(status);

-- =============================================================================
-- 3. NETWORK SERVICES
-- =============================================================================
CREATE TABLE IF NOT EXISTS network_services (
    service_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name    VARCHAR(200) NOT NULL UNIQUE,
    service_type    VARCHAR(50)  NOT NULL,       -- e.g. Backbone, VPN, ISP, Wholesale
    priority        VARCHAR(10)  DEFAULT 'P3',   -- P1 (highest) .. P4
    description     TEXT,
    customer_name   VARCHAR(200),
    sla_tier        VARCHAR(50),
    dependent_devices UUID[]     NOT NULL DEFAULT '{}',  -- device_ids this service rides on
    status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','operational','degraded','down','maintenance')),
    customer_count  INTEGER      DEFAULT 0,
    metadata        JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_status      ON network_services(status);
CREATE INDEX IF NOT EXISTS idx_services_priority    ON network_services(priority);

-- =============================================================================
-- 4. NETWORK ALARMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS network_alarms (
    alarm_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           UUID        REFERENCES network_devices(device_id) ON DELETE SET NULL,
    device_name         VARCHAR(100) NOT NULL,
    alarm_type          VARCHAR(100) NOT NULL,
    severity            VARCHAR(20)  NOT NULL
                            CHECK (severity IN ('Critical','Major','Minor','Warning','Info')),
    interface_name      VARCHAR(100),
    description         TEXT,
    alarm_timestamp     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alarm_source        VARCHAR(50)  DEFAULT 'simulate_api',
    processing_status   VARCHAR(30)  NOT NULL DEFAULT 'received'
                            CHECK (processing_status IN ('received','processing','processed','failed','deduplicated')),
    incident_id         UUID,       -- FK added after network_incidents table (below)
    raw_payload         JSONB        DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alarms_device_id    ON network_alarms(device_id);
CREATE INDEX IF NOT EXISTS idx_alarms_severity     ON network_alarms(severity);
CREATE INDEX IF NOT EXISTS idx_alarms_status       ON network_alarms(processing_status);
CREATE INDEX IF NOT EXISTS idx_alarms_timestamp    ON network_alarms(alarm_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alarms_incident_id  ON network_alarms(incident_id);
-- Deduplication: find recent alarms for same device+type within a window
CREATE INDEX IF NOT EXISTS idx_alarms_dedup
    ON network_alarms(device_name, alarm_type, alarm_timestamp DESC)
    WHERE processing_status NOT IN ('deduplicated','failed');

-- =============================================================================
-- 5. NETWORK INCIDENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS network_incidents (
    incident_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    alarm_id                UUID        REFERENCES network_alarms(alarm_id) ON DELETE SET NULL,
    incident_title          VARCHAR(500),
    incident_status         VARCHAR(30)  NOT NULL DEFAULT 'open'
                                CHECK (incident_status IN ('open','investigating','resolved','closed','duplicate')),
    severity                VARCHAR(20)  NOT NULL
                                CHECK (severity IN ('Critical','Major','Minor','Warning','Info')),
    -- AI agent outputs (stored as JSONB for flexibility)
    classification_result   JSONB,
    rca_result              JSONB,
    topology_result         JSONB,
    remediation_result      JSONB,
    -- Derived fields populated from agent outputs
    probable_root_cause     TEXT,
    supporting_evidence     JSONB        DEFAULT '[]',
    alternative_causes      JSONB        DEFAULT '[]',
    confidence_estimate     NUMERIC(4,3),
    affected_devices        JSONB        DEFAULT '[]',
    affected_services       JSONB        DEFAULT '[]',
    impact_level            VARCHAR(20),
    recommended_actions     JSONB        DEFAULT '[]',
    requires_human_approval BOOLEAN      NOT NULL DEFAULT TRUE,
    full_report             TEXT,        -- full markdown incident report from NETOPS-05
    estimated_repair_time   VARCHAR(100),
    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incidents_status   ON network_incidents(incident_status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON network_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created  ON network_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_alarm    ON network_incidents(alarm_id);

-- Now that both tables exist, add FK from alarms → incidents
ALTER TABLE network_alarms
    ADD CONSTRAINT fk_alarms_incident
    FOREIGN KEY (incident_id)
    REFERENCES network_incidents(incident_id)
    ON DELETE SET NULL;

-- =============================================================================
-- 6. AGENT EXECUTION LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    log_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id     UUID        REFERENCES network_incidents(incident_id) ON DELETE CASCADE,
    alarm_id        UUID        REFERENCES network_alarms(alarm_id) ON DELETE SET NULL,
    agent_name      VARCHAR(100) NOT NULL,
    execution_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (execution_status IN ('pending','running','success','failed','timeout')),
    input_tokens    INTEGER      DEFAULT 0,
    output_tokens   INTEGER      DEFAULT 0,
    duration_ms     INTEGER,
    error_message   TEXT,
    input_summary   TEXT,
    output_summary  TEXT,
    input_data      JSONB        DEFAULT '{}',
    output_data     JSONB        DEFAULT '{}',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_logs_incident_id  ON agent_execution_logs(incident_id);
CREATE INDEX IF NOT EXISTS idx_logs_agent_name   ON agent_execution_logs(agent_name);
CREATE INDEX IF NOT EXISTS idx_logs_status       ON agent_execution_logs(execution_status);
CREATE INDEX IF NOT EXISTS idx_logs_started_at   ON agent_execution_logs(started_at DESC);

-- =============================================================================
-- AUTO-UPDATE updated_at trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_devices_updated_at
    BEFORE UPDATE ON network_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_links_updated_at
    BEFORE UPDATE ON network_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_services_updated_at
    BEFORE UPDATE ON network_services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_alarms_updated_at
    BEFORE UPDATE ON network_alarms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_incidents_updated_at
    BEFORE UPDATE ON network_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- GRANTS (adjust user name if needed; docker-compose sets DB_USER=netopsai)
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'netopsai') THEN
        GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO netopsai;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO netopsai;
        GRANT EXECUTE ON ALL FUNCTIONS        IN SCHEMA public TO netopsai;
    END IF;
END
$$;
