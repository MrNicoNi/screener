-- 24_calibration_revoke_anon.sql — tira as funções auxiliares de calibração da
-- superfície RPC do anon. Elas existem só para o RLS (papel authenticated), então
-- o anon não precisa executá-las. authenticated mantém o EXECUTE (via public),
-- que o RLS exige.
REVOKE EXECUTE ON FUNCTION calib_is_creator(UUID)      FROM anon;
REVOKE EXECUTE ON FUNCTION calib_is_member(UUID)       FROM anon;
REVOKE EXECUTE ON FUNCTION calib_is_closed(UUID)       FROM anon;
REVOKE EXECUTE ON FUNCTION calib_owns_participant(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION calib_item_visible(UUID)    FROM anon;
REVOKE EXECUTE ON FUNCTION close_calibration_if_complete() FROM anon;
