# react-simple-auth-openid-provider

An generic OpenId provider for [react-simple-auth](https://github.com/mattmazzola/react-simple-auth).

## Usage

```
    OAuth2Provider.FromOpenIdConfigurationUrl({
        authority: "https://localhost:7001",
        clientId: "my client id",
        scope: ["my scope", "openid", "profile"]
    })
      .then(provider => {
        await RSA.restoreSession(provider)
        await RSA.acquireTokenAsync(provider);
      })
      .catch(err => console.log("Got an error", err));
```

How I have used it with mobx and React Hooks:

```
// Auth.ts
export class Auth {
  @observable
  private session: Session | undefined;

  @observable
  private provider: IProvider<Session> | undefined;

  @action
  updateProvider(provider: IProvider<Session>) {
    this.provider = provider;
    this.session = RSA.restoreSession(provider);
  }

  @computed
  get canLogin() {
    return !!this.provider;
  }

  @computed
  get isAuthenticated() {
    return (
      (this.session && typeof this.session.accessToken === "string") || false
    );
  }

  @computed
  get accessToken() {
    return this.session && this.session.accessToken;
  }

  async login() {
    if (this.provider) {
      this.session = await RSA.acquireTokenAsync(this.provider);
    }
  }

  logout() {
    RSA.invalidateSession();
    this.session = undefined;
  }
}

const defaultAuth = new Auth();
export const AuthContext = React.createContext(defaultAuth);
export const Authentication = (props: {
  children?: React.ReactNode;
  options: SecurityOptions;
}) => {
  const auth = React.useContext(AuthContext);
  const apiConfig = React.useContext(ConfigContext);
  apiConfig.auth = auth;

  React.useEffect(() => {
    OAuth2Provider.FromOpenIdConfigurationUrl(props.options)
      .then(p => {
        auth.updateProvider(p);
      })
      .catch(err => console.log("Got an error", err));
  }, [props.options]);

  return <React.Fragment>{props.children}</React.Fragment>;
};

// Then in App
const App = () => {
  return (
    <Authentication
      options={{
        authority: "https://localhost:7001",
        clientId: "my client id",
        scope: ["my scope", "openid", "profile"]
      }}
    >
      <Protector>
        <div>I will only be shown if the user is logged in</div>
      </Protector>
    </Authentication>
  );
};

const Protector = () => {
    const auth = React.useContext(AuthContext);
    return useObserver(() => {
        if (auth.canLogin) {
            if (auth.isAuthenticated) {
                return <React.Fragment>
                    {props.children}
                    <button onClick={() => auth.logout()}>Logout</button>
                </React.Fragment>;
            }

            return <div>
                <div>You need to login to see this</div>
                <button onClick={() => auth.login()}>Login</button>
            </div>;
        } else {
        return <div>"Wait a mo"</div>;
        }
    });
}
```

# More details

This is based of [IdentityServer4](https://github.com/IdentityServer/IdentityServer4) installation running on port 7001. It publishes a json document `/.well-known/openid-configuration` which all open-id providers _should_ use, this provider reads this file and extracts information to build login/logout URIs.
It currently uses the `implict` login type
