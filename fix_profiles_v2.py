import configparser
import os

ini_path = os.path.expanduser('~/.mozilla/firefox/profiles.ini')
config = configparser.ConfigParser()
config.optionxform = str
config.read(ini_path)

# Remove Profile1
if 'Profile1' in config:
    del config['Profile1']

# Ensure Profile0 is set to default
if 'Profile0' in config:
    config['Profile0']['Default'] = '1'
    config['Profile0']['Name'] = 'default-release'
    config['Profile0']['Path'] = '8aqwmy30.default-release'

# Make sure StartWithLastProfile is off so it reads Default=1
if 'General' in config:
    config['General']['StartWithLastProfile'] = '0'

with open(ini_path, 'w') as configfile:
    config.write(configfile, space_around_delimiters=False)
