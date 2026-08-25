-- 16_template_rls.sql — templates são dado de referência: todos leem, só admin escreve
ALTER TABLE evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_criteria    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tmpl_select_all ON evaluation_templates;
CREATE POLICY tmpl_select_all ON evaluation_templates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tmpl_admin_write ON evaluation_templates;
CREATE POLICY tmpl_admin_write ON evaluation_templates
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS tcrit_select_all ON template_criteria;
CREATE POLICY tcrit_select_all ON template_criteria
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tcrit_admin_write ON template_criteria;
CREATE POLICY tcrit_admin_write ON template_criteria
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
