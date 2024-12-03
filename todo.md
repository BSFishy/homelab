# todo

adding this so i dont forget things

- ~add authelia for service~ & cloudflare access auth
- ~finish converting things through to ansible roles~
- allow deployment in "dev mode" where it appends something to the url
- finish making things use variables/be configurable (mainly domain stuff)
- make everything use ~docker secrets~ and configs
- setup depends on for all services
- do replication config on all services
- do health metrics thing on all services
- get us using some good volume stuff :D
- ~fix volume mount permissions~
- add ansible arg to take the network down
- ~make portainer use ldap~

  - okay this is super fucking annoying but they neither

    > 1. allow me to configure ldap using cli args
    > 2. allow me to configure ldap using env vars
    > 3. allow me to configure ldap using config files
    > 4. allow me to disable auth

    so i guess this is just not gonna happen unless i contribute anything like
    this or wait until they just do it. so just whatever i guess i dont care

- move to docker volumes instead of mounts or whatever
  - set up volumes to mount to a shared network drive?
- make all the docker composes style consistent
- fix cfzt-sync to match on settings and delete what doesnt match instead of
  matching on names
- improve config experience
  - we could definitely make it so that we specify the api key/email or api
    token then it lets you select from the list of everything else to make the
    configuration experience WAYYYY better
  - should also be able to use api tokens
- configure \*arrs and jellyfin through apis in manager service
- make networks rolling release like the config in authelia :)
- make the manager use a system of locking along with the debouncer
