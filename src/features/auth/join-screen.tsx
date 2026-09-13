import { RoutePlaceholder } from '@/components/route-placeholder'
import { useRouteParam } from '@/lib/use-route-param'

/** Placeholder. S2.4 builds this screen. */
export default function JoinScreen(): React.JSX.Element {
  const token = useRouteParam('token')
  return <RoutePlaceholder story="S2.4" name="Join team" detail={`token: ${token}`} />
}
