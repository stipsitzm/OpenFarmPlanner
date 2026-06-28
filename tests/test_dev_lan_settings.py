from config import settings as settings_module


def test_local_dev_origins_include_common_frontend_ports() -> None:
    origins = settings_module._local_dev_origins(['192.168.178.125'])

    assert origins == [
        'http://192.168.178.125:5173',
        'http://192.168.178.125:4173',
        'http://192.168.178.125:3000',
    ]


def test_development_lan_hosts_use_env_and_detected_ip(monkeypatch) -> None:
    monkeypatch.setenv('DEV_LAN_HOSTS', '192.168.178.125,localhost,127.0.0.1')
    monkeypatch.setenv('DEV_LAN_IPS', '192.168.178.126')
    monkeypatch.setattr(settings_module, '_detect_lan_ip', lambda: '192.168.178.125')

    assert settings_module._development_lan_hosts() == [
        '192.168.178.125',
        '192.168.178.126',
    ]
