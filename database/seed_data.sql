-- NetOpsAI Seed Data — Fictional telecom backbone network (SIMULATED — not real production data)
BEGIN;

-- ============================================================
-- Network Devices (10)
-- ============================================================
INSERT INTO network_devices (device_id,device_name,device_type,vendor,management_ip,location,network_role,status) VALUES
('11111111-0001-0001-0001-000000000001','DHK-CORE-01','Core','Cisco','10.0.0.1','Dhaka Core DC','core','active'),
('11111111-0001-0001-0001-000000000002','DHK-AGG-01','Aggregation','Juniper','10.0.0.2','Dhaka Zone-A Hub','aggregation','active'),
('11111111-0001-0001-0001-000000000003','DHK-AGG-02','Aggregation','Juniper','10.0.0.3','Dhaka Zone-B Hub','aggregation','active'),
('11111111-0001-0001-0001-000000000004','SYL-CO-01','Router','Huawei','10.0.1.1','Sylhet Central CO','edge','active'),
('11111111-0001-0001-0001-000000000005','BAL-CO-01','Router','Huawei','10.0.2.1','Barisal Central CO','edge','active'),
('11111111-0001-0001-0001-000000000006','RAJ-CORE-01','Core','Cisco','10.0.3.1','Rajshahi Core DC','core','active'),
('11111111-0001-0001-0001-000000000007','CTG-CORE-01','Core','Cisco','10.0.4.1','Chittagong Core DC','core','active'),
('11111111-0001-0001-0001-000000000008','CTG-AGG-01','Aggregation','Nokia','10.0.4.2','Chittagong Zone Hub','aggregation','active'),
('11111111-0001-0001-0001-000000000009','DHK-DWDM-01','DWDM','Ciena','10.0.0.10','Dhaka DWDM Ring-1','core','active'),
('11111111-0001-0001-0001-000000000010','CTG-DWDM-01','DWDM','Ciena','10.0.4.10','Chittagong DWDM Ring','core','active');

-- ============================================================
-- Network Links (8)
-- ============================================================
INSERT INTO network_links (link_id,link_name,source_device_id,dest_device_id,source_interface,dest_interface,link_type,capacity_gbps,status,is_protected) VALUES
('22222222-0002-0002-0002-000000000001','DHK-CORE-01 to DHK-AGG-01','11111111-0001-0001-0001-000000000001','11111111-0001-0001-0001-000000000002','Te0/0/0','Te0/0/0','fiber',100.0,'active',TRUE),
('22222222-0002-0002-0002-000000000002','DHK-CORE-01 to DHK-AGG-02','11111111-0001-0001-0001-000000000001','11111111-0001-0001-0001-000000000003','Te0/0/1','Te0/0/0','fiber',100.0,'active',TRUE),
('22222222-0002-0002-0002-000000000003','DHK-AGG-01 to SYL-CO-01','11111111-0001-0001-0001-000000000002','11111111-0001-0001-0001-000000000004','Ge0/0/0','Ge0/0/0','fiber',10.0,'active',FALSE),
('22222222-0002-0002-0002-000000000004','DHK-AGG-02 to BAL-CO-01','11111111-0001-0001-0001-000000000003','11111111-0001-0001-0001-000000000005','Ge0/0/0','Ge0/0/0','fiber',10.0,'active',FALSE),
('22222222-0002-0002-0002-000000000005','DHK-CORE-01 to RAJ-CORE-01','11111111-0001-0001-0001-000000000001','11111111-0001-0001-0001-000000000006','Te0/1/0','Te0/1/0','optical',100.0,'active',TRUE),
('22222222-0002-0002-0002-000000000006','DHK-CORE-01 to CTG-CORE-01','11111111-0001-0001-0001-000000000001','11111111-0001-0001-0001-000000000007','Te0/1/1','Te0/1/0','optical',100.0,'active',TRUE),
('22222222-0002-0002-0002-000000000007','CTG-CORE-01 to CTG-AGG-01','11111111-0001-0001-0001-000000000007','11111111-0001-0001-0001-000000000008','Ge0/0/0','Ge0/0/0','fiber',10.0,'active',FALSE),
('22222222-0002-0002-0002-000000000008','DHK-DWDM-01 to CTG-DWDM-01','11111111-0001-0001-0001-000000000009','11111111-0001-0001-0001-000000000010','Ch1','Ch1','optical',400.0,'active',TRUE);

-- ============================================================
-- Network Services (5)
-- ============================================================
INSERT INTO network_services (service_id,service_name,service_type,priority,description,status) VALUES
('33333333-0003-0003-0003-000000000001','ISP Backbone Service A','Backbone','P1','Primary national ISP backbone interconnect','active'),
('33333333-0003-0003-0003-000000000002','Enterprise VPN Service B','VPN','P2','Enterprise MPLS VPN for corporate clients','active'),
('33333333-0003-0003-0003-000000000003','Sylhet Broadband Bundle','ISP','P2','Consumer broadband in Sylhet region','active'),
('33333333-0003-0003-0003-000000000004','Chittagong Wholesale Link','Wholesale','P1','Wholesale bandwidth to Chittagong partners','active'),
('33333333-0003-0003-0003-000000000005','DWDM Optical Transport Ring','Backbone','P1','Core optical transport ring DHK-CTG','active');

-- Service -> device dependencies (used by NETOPS-04 Topology Impact)
UPDATE network_services SET customer_name='National ISP Partners', sla_tier='Platinum', customer_count=1200000, dependent_devices=ARRAY['11111111-0001-0001-0001-000000000001','11111111-0001-0001-0001-000000000006','11111111-0001-0001-0001-000000000007']::uuid[] WHERE service_id='33333333-0003-0003-0003-000000000001';
UPDATE network_services SET customer_name='Corporate VPN Clients', sla_tier='Gold', customer_count=450, dependent_devices=ARRAY['11111111-0001-0001-0001-000000000001','11111111-0001-0001-0001-000000000002','11111111-0001-0001-0001-000000000003']::uuid[] WHERE service_id='33333333-0003-0003-0003-000000000002';
UPDATE network_services SET customer_name='Sylhet Residential', sla_tier='Silver', customer_count=85000, dependent_devices=ARRAY['11111111-0001-0001-0001-000000000002','11111111-0001-0001-0001-000000000004']::uuid[] WHERE service_id='33333333-0003-0003-0003-000000000003';
UPDATE network_services SET customer_name='Chittagong Wholesale Partners', sla_tier='Platinum', customer_count=60, dependent_devices=ARRAY['11111111-0001-0001-0001-000000000007','11111111-0001-0001-0001-000000000008','11111111-0001-0001-0001-000000000010']::uuid[] WHERE service_id='33333333-0003-0003-0003-000000000004';
UPDATE network_services SET customer_name='Internal Transport', sla_tier='Platinum', customer_count=0, dependent_devices=ARRAY['11111111-0001-0001-0001-000000000009','11111111-0001-0001-0001-000000000010']::uuid[] WHERE service_id='33333333-0003-0003-0003-000000000005';

-- ============================================================
-- Network Alarms (15) — incident_id linked after incidents inserted
-- ============================================================
INSERT INTO network_alarms (alarm_id,device_id,device_name,alarm_type,severity,interface_name,description,alarm_timestamp,processing_status,raw_payload) VALUES
('44444444-0004-0004-0004-000000000001','11111111-0001-0001-0001-000000000002','DHK-AGG-01','LOS','Critical','Ge0/0/0','Loss of Signal on Ge0/0/0 upstream interface','2026-10-25 08:01:00+06','processed','{"source":"EMS","raw_type":"LOS","interface":"Ge0/0/0"}'),
('44444444-0004-0004-0004-000000000002','11111111-0001-0001-0001-000000000004','SYL-CO-01','Interface Down','Major','Ge0/0/0','Interface Ge0/0/0 went down upstream LOS suspected','2026-10-25 08:01:35+06','processed','{"source":"EMS","raw_type":"IF_DOWN","interface":"Ge0/0/0"}'),
('44444444-0004-0004-0004-000000000003','11111111-0001-0001-0001-000000000001','DHK-CORE-01','Optical Power Low','Major','Te0/1/1','Rx optical power below threshold on Te0/1/1','2026-10-25 09:15:00+06','processed','{"source":"NMS","raw_type":"OPT_PWR_LOW","rx_power_dbm":-25.5}'),
('44444444-0004-0004-0004-000000000004','11111111-0001-0001-0001-000000000007','CTG-CORE-01','Optical Power Low','Major','Te0/1/0','Rx optical power degraded possible connector issue','2026-10-25 09:15:45+06','processed','{"source":"NMS","raw_type":"OPT_PWR_LOW","rx_power_dbm":-26.1}'),
('44444444-0004-0004-0004-000000000005','11111111-0001-0001-0001-000000000008','CTG-AGG-01','Interface Down','Critical','Ge0/0/0','Interface Ge0/0/0 down upstream path degraded','2026-10-25 09:16:10+06','processed','{"source":"EMS","raw_type":"IF_DOWN","interface":"Ge0/0/0"}'),
('44444444-0004-0004-0004-000000000006','11111111-0001-0001-0001-000000000006','RAJ-CORE-01','Device Unreachable','Critical',NULL,'ICMP and SNMP polling failed device may have power issue','2026-10-25 11:00:00+06','processed','{"source":"NMS","last_seen":"2026-10-25T10:58:00Z"}'),
('44444444-0004-0004-0004-000000000007','11111111-0001-0001-0001-000000000001','DHK-CORE-01','LOF','Critical','Te0/1/0','Loss of Frame on Te0/1/0 backbone fiber failure suspected','2026-10-25 14:30:00+06','processed','{"source":"EMS","raw_type":"LOF","interface":"Te0/1/0"}'),
('44444444-0004-0004-0004-000000000008','11111111-0001-0001-0001-000000000006','RAJ-CORE-01','LOS','Critical','Te0/1/0','Loss of Signal backbone correlates with DHK-CORE-01 LOF','2026-10-25 14:30:30+06','processed','{"source":"EMS","raw_type":"LOS","interface":"Te0/1/0"}'),
('44444444-0004-0004-0004-000000000009','11111111-0001-0001-0001-000000000002','DHK-AGG-01','LOS','Critical','Ge0/0/0','DUPLICATE: Loss of Signal on Ge0/0/0 upstream interface','2026-10-25 08:01:05+06','deduplicated','{"source":"EMS","raw_type":"LOS","duplicate":true}'),
('44444444-0004-0004-0004-000000000010','11111111-0001-0001-0001-000000000009','DHK-DWDM-01','High BER','Major','Ch1','Bit Error Rate exceeding threshold on DWDM Ch1','2026-10-26 07:20:00+06','received','{"source":"NMS","ber":"1e-7","channel":"Ch1"}'),
('44444444-0004-0004-0004-000000000011','11111111-0001-0001-0001-000000000010','CTG-DWDM-01','High BER','Major','Ch1','Correlated High BER on CTG DWDM ring Ch1','2026-10-26 07:20:45+06','received','{"source":"NMS","ber":"1.2e-7","channel":"Ch1"}'),
('44444444-0004-0004-0004-000000000012','11111111-0001-0001-0001-000000000003','DHK-AGG-02','Card Failure','Critical','LINECARD-2','Line card LINECARD-2 failed hardware fault detected','2026-10-26 10:45:00+06','received','{"source":"EMS","slot":"LINECARD-2"}'),
('44444444-0004-0004-0004-000000000013','11111111-0001-0001-0001-000000000005','BAL-CO-01','Interface Down','Minor','Ge0/0/1','Interface Ge0/0/1 went down customer port affected','2026-10-26 12:00:00+06','received','{"source":"EMS","raw_type":"IF_DOWN","interface":"Ge0/0/1"}'),
('44444444-0004-0004-0004-000000000014','11111111-0001-0001-0001-000000000002','DHK-AGG-01','Optical Power Low','Warning','Te0/0/0','Rx power slightly below optimal range monitor closely','2026-10-27 06:30:00+06','received','{"source":"NMS","rx_power_dbm":-20.5}'),
('44444444-0004-0004-0004-000000000015','11111111-0001-0001-0001-000000000007','CTG-CORE-01','LOS','Critical','Te0/1/0','Loss of Signal on CTG-CORE-01 backbone interface','2026-10-27 08:00:00+06','received','{"source":"EMS","raw_type":"LOS","interface":"Te0/1/0"}');

-- ============================================================
-- Network Incidents (5)
-- ============================================================
INSERT INTO network_incidents (incident_id,alarm_id,incident_title,severity,probable_root_cause,supporting_evidence,alternative_causes,confidence_estimate,affected_devices,affected_services,impact_level,recommended_actions,requires_human_approval,incident_status,created_at,updated_at) VALUES
('55555555-0005-0005-0005-000000000001','44444444-0004-0004-0004-000000000001',
 'Critical LOS Alarm on DHK-AGG-01 — Upstream Fiber Failure Suspected','Critical',
 'Upstream fiber cut or transceiver failure on DHK-AGG-01 Ge0/0/0',
 '["LOS alarm on Ge0/0/0","SYL-CO-01 IF Down 35s later","Link DHK-AGG-01 to SYL-CO-01 unprotected"]',
 '["Optical transceiver failure","Remote power failure at SYL-CO-01","Physical connector issue"]',
 0.87,'["DHK-AGG-01","SYL-CO-01"]','["Enterprise VPN Service B","Sylhet Broadband Bundle"]','High',
 '["Dispatch field team to check fiber route","Verify Rx optical power on DHK-AGG-01","Check ODF at Sylhet CO","Escalate to NOC Tier-2"]',
 TRUE,'resolved','2026-10-25 08:05:00+06','2026-10-25 10:30:00+06'),

('55555555-0005-0005-0005-000000000002','44444444-0004-0004-0004-000000000003',
 'Optical Power Degradation on DHK-CORE-01 Te0/1/1 — Cascading Impact to CTG','Major',
 'Fiber degradation or connector issue on DHK-CORE-01 to CTG-CORE-01 backbone link',
 '["Low power DHK -25.5dBm","Correlated low power CTG -26.1dBm 45s later","CTG-AGG-01 down 70s later"]',
 '["Fiber micro-bend","Connector contamination","EDFA gain degradation"]',
 0.79,'["DHK-CORE-01","CTG-CORE-01","CTG-AGG-01"]','["ISP Backbone Service A","Chittagong Wholesale Link"]','High',
 '["Clean optical connectors on DHK-CORE-01 Te0/1/1","Check EDFA output power","Run OTDR test on DHK-CTG backbone","Verify protection switching"]',
 TRUE,'investigating','2026-10-25 09:20:00+06','2026-10-25 09:20:00+06'),

('55555555-0005-0005-0005-000000000003','44444444-0004-0004-0004-000000000006',
 'RAJ-CORE-01 Device Unreachable — Possible Power Failure','Critical',
 'Power supply failure or management connectivity loss at Rajshahi Core DC',
 '["ICMP and SNMP both failed","Last poll 2 minutes before alarm","No upstream interface alarms"]',
 '["DC power outage at Rajshahi","Management network failure","Device crash or reboot"]',
 0.72,'["RAJ-CORE-01"]','["ISP Backbone Service A"]','Critical',
 '["Contact Rajshahi DC facility team","Check DC power and UPS status","Attempt remote console access","Prepare emergency on-site dispatch"]',
 TRUE,'open','2026-10-25 11:05:00+06','2026-10-25 11:05:00+06'),

('55555555-0005-0005-0005-000000000004','44444444-0004-0004-0004-000000000007',
 'Backbone Fiber Failure DHK-CORE-01 → RAJ-CORE-01 — LOF and LOS Correlated','Critical',
 'Physical fiber cut on the DHK-CORE-01 to RAJ-CORE-01 backbone segment',
 '["LOF on DHK-CORE-01 Te0/1/0","LOS on RAJ-CORE-01 Te0/1/0 within 30s","Both ends same protected link"]',
 '["Dual transceiver failure","Cable damage in conduit","DWDM multiplexer fault"]',
 0.91,'["DHK-CORE-01","RAJ-CORE-01"]','["ISP Backbone Service A"]','Critical',
 '["Activate protection switching immediately","Contact OSSP fiber team","Dispatch fiber repair team","Run OTDR to locate cut","Notify affected wholesale customers"]',
 TRUE,'open','2026-10-25 14:35:00+06','2026-10-25 14:35:00+06'),

('55555555-0005-0005-0005-000000000005','44444444-0004-0004-0004-000000000009',
 '[DUPLICATE] LOS on DHK-AGG-01 Ge0/0/0 — Deduplicated to INC-001','Critical',
 'Duplicate alarm — original incident INC-001 already created for this alarm',
 '["Alarm arrived within 5s of original","Same device interface and alarm type","Deduplication check matched existing open incident"]',
 '[]',
 1.0,'["DHK-AGG-01"]','[]','None',
 '["No action required — refer to INC-001"]',
 FALSE,'duplicate','2026-10-25 08:06:00+06','2026-10-25 08:06:00+06');

-- Link alarms to incidents
UPDATE network_alarms SET incident_id='55555555-0005-0005-0005-000000000001' WHERE alarm_id IN ('44444444-0004-0004-0004-000000000001','44444444-0004-0004-0004-000000000002');
UPDATE network_alarms SET incident_id='55555555-0005-0005-0005-000000000002' WHERE alarm_id IN ('44444444-0004-0004-0004-000000000003','44444444-0004-0004-0004-000000000004','44444444-0004-0004-0004-000000000005');
UPDATE network_alarms SET incident_id='55555555-0005-0005-0005-000000000003' WHERE alarm_id='44444444-0004-0004-0004-000000000006';
UPDATE network_alarms SET incident_id='55555555-0005-0005-0005-000000000004' WHERE alarm_id IN ('44444444-0004-0004-0004-000000000007','44444444-0004-0004-0004-000000000008');
UPDATE network_alarms SET incident_id='55555555-0005-0005-0005-000000000005' WHERE alarm_id='44444444-0004-0004-0004-000000000009';

-- ============================================================
-- Agent Execution Logs (sample for INC-001)
-- ============================================================
INSERT INTO agent_execution_logs (log_id,incident_id,alarm_id,agent_name,execution_status,input_summary,output_summary,duration_ms,started_at,completed_at) VALUES
('66666666-0006-0006-0006-000000000001','55555555-0005-0005-0005-000000000001','44444444-0004-0004-0004-000000000001','orchestrator','success','Alarm: LOS on DHK-AGG-01, Severity: Critical','Coordinated 4 specialist agents, all returned results. Incident consolidated.',3200,'2026-10-25 08:05:00+06','2026-10-25 08:05:03+06'),
('66666666-0006-0006-0006-000000000002','55555555-0005-0005-0005-000000000001','44444444-0004-0004-0004-000000000001','alarm_classification','success','Alarm type: LOS, Device: DHK-AGG-01','Category: Optical, Severity: Critical, requires_investigation: true',850,'2026-10-25 08:05:00+06','2026-10-25 08:05:01+06'),
('66666666-0006-0006-0006-000000000003','55555555-0005-0005-0005-000000000001','44444444-0004-0004-0004-000000000001','root_cause_analysis','success','LOS on DHK-AGG-01, related alarms: SYL-CO-01 IF_DOWN','Root cause: Fiber failure, confidence: 0.87',1200,'2026-10-25 08:05:01+06','2026-10-25 08:05:02+06'),
('66666666-0006-0006-0006-000000000004','55555555-0005-0005-0005-000000000001','44444444-0004-0004-0004-000000000001','topology_impact','success','Device: DHK-AGG-01, links to SYL-CO-01','Affected nodes: DHK-AGG-01, SYL-CO-01. Impact: High',900,'2026-10-25 08:05:01+06','2026-10-25 08:05:02+06'),
('66666666-0006-0006-0006-000000000005','55555555-0005-0005-0005-000000000001','44444444-0004-0004-0004-000000000001','remediation_report','success','RCA: fiber failure, Impact: High','3 recommended actions. Human approval required.',780,'2026-10-25 08:05:02+06','2026-10-25 08:05:03+06');

COMMIT;
