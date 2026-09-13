import { RoutePlaceholder } from '@/components/route-placeholder'
import { useRouteParam } from '@/lib/use-route-param'

/** Placeholder. S2.3 builds this screen. */
export default function ResetScreen(): React.JSX.Element {
  const token = useRouteParam('token')
  return <RoutePlaceholder story="S2.3" name="Set password" detail={`token: ${token}`} />
}
