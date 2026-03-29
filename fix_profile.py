import configparser
import os

ini_path = os.path.expanduser('~/.mozilla/firefox/profiles.ini')
config = configparser.ConfigParser()
# Preserve case
config.optionxform = str
config.read(ini_path)

# Find the profile with Path=8aqwmy30.default-release
for section in config.sections():
    if section.startswith('Profile'):
        if config[section].get('Path') == '8aqwmy30.default-release':
            config[section]['Default'] = '1'
        else:
            if 'Default' in config[section]:
                del config[section]['Default']

# Also fix the install section
for section in config.sections():
    if section.startswith('Install'):
        config[section]['Default'] = '8aqwmy30.default-release'

with open(ini_path, 'w') as configfile:
    # write with no spaces around '=' to match original format
    config.write(configfile, space_around_delimiters=False)
