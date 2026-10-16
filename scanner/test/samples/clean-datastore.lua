local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("Coins")

game.Players.PlayerAdded:Connect(function(player)
	local ok, coins = pcall(function()
		return store:GetAsync("player_" .. player.UserId)
	end)
	print(player.Name, ok and coins or 0)
end)
